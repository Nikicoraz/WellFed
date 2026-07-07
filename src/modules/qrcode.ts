import { type AuthenticatedRequest, clientOnly, merchantOnly } from "../middleware/authentication.js";
import { TransactionStatus, TransactionType } from "../models/transaction.js";
import { activeTransactions, transactionCount, transactionDuration } from "./prometheusClient.js";
import Client from "../models/client.js";
import Merchant from "../models/merchant.js";
import Prize from "../models/prize.js";
import Product from "../models/product.js";
import type { Types } from "mongoose";
import express from "express";
import jwt from "jsonwebtoken";
import { logTransaction } from "./transactions.js";
import { logger } from "./logger.js";
import qrcode from "qrcode";

const router = express.Router();

enum QRTypes {
    Assignment,
    Redeem
}

interface AssignObject {
    productID: Types.ObjectId,
    quantity: number,
}

interface QR {
    type: QRTypes
}

class AssignmentQR implements QR {
    type: QRTypes;
    productQuantityList: AssignObject[];
    totalPoints: number;
    shopID: Types.ObjectId;

    constructor(productQuantityList: AssignObject[], totalPoints: number, shopID: Types.ObjectId) {
        this.type = QRTypes.Assignment;
        this.productQuantityList = productQuantityList;
        this.totalPoints = totalPoints;
        this.shopID = shopID;
    }
}

class RedeemQR implements QR {
    type: QRTypes;
    prizeID: Types.ObjectId;
    clientID: Types.ObjectId;

    constructor(prizeID: Types.ObjectId, clientID: Types.ObjectId) {
        this.type = QRTypes.Redeem;
        this.prizeID = prizeID;
        this.clientID = clientID;
    }
}

let pendingTokens: PendingToken[] = [];
class PendingToken {
    token: string;
    timeout: NodeJS.Timeout | null;
    startTime: ReturnType<typeof transactionDuration.startTimer>;

    constructor(token: string, timeout: NodeJS.Timeout | null = null) {
        this.token = token;
        this.timeout = timeout;
        this.startTime = transactionDuration.startTimer();
    }

    clear() {
        if (this.timeout) {
            clearTimeout(this.timeout);
        }

        pendingTokens = pendingTokens.filter(e => {
            return e != this;
        });

        activeTransactions.dec();
        this.startTime();
    }
}


function addPendingToken(token: string) {
    transactionCount.inc();
    activeTransactions.inc();
    const pending = new PendingToken(token);
    pendingTokens.push(pending);
    const t = setTimeout(() => {
        pending.clear();
    }, 1000 * 60 * 2); // 2 minutes
    pending.timeout = t;
}

export function clearAllPendingTimers() {
    pendingTokens.forEach(t => {
        t.clear();
    });
}


router.post("/assignPoints", merchantOnly, async (req, res) => {
    const reqId = req.headers["x-request-id"];

    try {
        const authReq = req as AuthenticatedRequest;

        const array: AssignObject[] = req.body;
        let pointsSum = 0;
    
        logger.info({ reqId, merchantId: authReq.user.id, items: array.length }, "QR assign request");

        for (const e of array) {
            const product = await Product.findById(e.productID);
            if (!product) {
                logger.warn({ reqId, productID: e.productID }, "Product missing in QR assignment");
                continue;
            }
            pointsSum += (product.points ?? 0) * e.quantity;
        }
    
        const payload: AssignmentQR = new AssignmentQR(array, pointsSum, authReq.user.id);

        // Il token scade in 2 minuti
        const token = jwt.sign({...payload}, process.env.PRIVATE_KEY!, {expiresIn: "2m"});

        qrcode.toDataURL(token, {type: "image/jpeg"}, (err, code) => {
            if (err) {
                logger.error({ err }, "QR generation failed");
                return res.sendStatus(500);
            }
            addPendingToken(token);

            logger.info({ merchantId: authReq.user.id, pointsSum }, "QR generated");

            res.send(code);
        });

    } catch (e) {
        logger.error({ err: e }, "assignPoints failed");
        res.sendStatus(400);
    }
});

router.post("/redeemPrize", clientOnly, async (req, res) => {

    try {
        const authReq = req as AuthenticatedRequest;

        
        const prizeID = req.body.prizeID.trim();
        if (prizeID == "") {
            return res.sendStatus(400);
        }

        const prize = await Prize.findById(prizeID);
        const client = await Client.findById(authReq.user.id);
        const shop = await Merchant.findOne({
            prizes: {$all: prizeID}
        });

        if (!shop || !prize) {
            return res.sendStatus(404);
        }

        const pointPath = `points.${shop!.id}`;
        const currentPoints: number = client!.get(pointPath);       // Il client non è mai null per il middleware

        if ((currentPoints ?? 0) - prize.points! < 0) {
            return res.sendStatus(402);
        }

        const payload: RedeemQR = new RedeemQR(prizeID, authReq.user.id);

        // Il token scade in 2 minuti
        const token = jwt.sign({...payload}, process.env.PRIVATE_KEY!, {expiresIn: "2m"});

        qrcode.toDataURL(token, {type: "image/jpeg"}, (err, code) => {
            if (err) {
                console.error(err);
                return res.sendStatus(500);
            }
            addPendingToken(token);
            res.send(code);
        });

    } catch (e) {
        console.error(e);
        res.sendStatus(400);
    }
});

router.post("/scanned", async(req, res) => {
    const reqId = req.headers["x-request-id"];

    try {
        const authReq = req as AuthenticatedRequest;

        logger.info({ reqId }, "QR code received");

        const token: string = req.body.token.trim();
        const payload = jwt.verify(token, process.env.PRIVATE_KEY!);
        const qrPayload = payload as QR;

        // eslint-disable-next-line brace-style
        if (!pendingTokens.some(t => { return t.token == token; })) { 
            logger.warn({ reqId }, "Invalid or expired QR token");
            res.sendStatus(400);
            return;
        }

        const qrType = qrPayload?.type;
        if (qrType == QRTypes.Assignment) {            
            if (!authReq.user.client) {
                logger.warn({ reqId, qrType, userId: authReq.user.id }, "QR rejected: assignment QR scanned by merchant");
                res.sendStatus(400);
                return;
            }

            logger.info({ reqId }, "Processing assignment QR");

            const clientID = authReq.user.id;
            const productQuantityList = (qrPayload as AssignmentQR).productQuantityList.map((e) => {
                return {product: e.productID, quantity: e.quantity};
            });

            const productOnlyList: Types.ObjectId[] = productQuantityList.map(e => {
                return e.product;
            });

            const shopID = (qrPayload as AssignmentQR).shopID;
            const points = (qrPayload as AssignmentQR).totalPoints;

            const shop = await Merchant.findOne({
                _id: shopID,
                products: {$all: productOnlyList}
            });

            // Se non sono presenti tutti i prodotti della richiesta nel negozio del mercante
            // allora il QR non è valido
            if (!shop) {
                logger.warn({ reqId, shopID }, "QR rejected: shop does not match product set");
                res.sendStatus(400);
                return;
            }


            const client = await Client.findById(clientID);
            if (!client) {
                logger.warn({ reqId }, "QR rejected: client not found (invalid or tampered ID)");
                // ID falso
                res.sendStatus(400);
                return;
            }
            const pointsString = `points.${shopID}`;
            const oldPoints: number = client.get(pointsString) || 0;
            client.set(pointsString, oldPoints + points);
            client.save();

            logger.debug({ reqId, clientID, shopID }, "Client points updated");

            logTransaction(shopID, clientID, points, TransactionType.PointAssignment, TransactionStatus.Success, {
                prizes: [],
                products: productQuantityList
            }, new Date());

            logger.debug({ reqId, clientID, shopID }, "Transtaction notified");

            logger.info({ reqId, qrType, clientID, shopID, pointsAdded: points }, "Assignment QR applied");
            // Update finished

        } else if (qrType == QRTypes.Redeem) {
            if (authReq.user.client) {
                logger.warn({ reqId, qrType, userId: authReq.user.id }, "QR rejected: redeem QR scanned by client");
                res.sendStatus(400);
                return;
            }
            
            logger.info({ reqId }, "Processing redeem QR");

            const shopID = authReq.user.id;
            const clientID = (qrPayload as RedeemQR).clientID;
            const prizeID = (qrPayload as RedeemQR).prizeID;

            const shop = await Merchant.findOne({
                _id: shopID,
                prizes: prizeID
            });

            // Nel caso lo shop non abbia il premio
            if (!shop) {
                logger.warn({ reqId, shopID, prizeID }, "QR rejected: shop does not have prize");
                res.sendStatus(400);
                return;
            }

            const prize = await Prize.findById(prizeID);
            if (!prize) {
                logger.warn({ reqId, prizeID }, "QR rejected: huh?");
                // What???
                res.sendStatus(400);
                return;
            }

            // Scala i punti dall'utente
            const client = await Client.findById(clientID);
            if (!client) {
                logger.warn({ reqId, clientID }, "QR rejected: client not found (invalid or tampered ID)");
                // Id falso
                res.sendStatus(400);
                return;
            }

            const pointPath = `points.${shopID}`;
            const currentPoints: number = client.get(pointPath);
            if (currentPoints - prize.points! < 0) {
                logger.warn({ reqId, clientID, prizeID }, "QR rejected: insufficient points");
                // needs more info? 
                // logger.warn({ reqId, clientID, shopID, currentPoints, requiredPoints }, "..."); 
                res.sendStatus(402);
                return;
            }
            
            client.set(pointPath, currentPoints - prize.points!);
            client.save();

            logger.debug({ reqId, clientID, shopID }, "Client points updated");

            logTransaction(clientID, shopID, prize.points!, TransactionType.PrizeRedeem, TransactionStatus.Success, {
                prizes: [prizeID],
                products: []
            }, new Date());

            logger.debug({ reqId, clientID, shopID }, "Transtaction notified");


            logger.info({ reqId, qrType, clientID, shopID, prizeID, pointsUsed: prize.points }, "Redeem QR applied");
        } else {
            logger.error({ reqId, qrType }, "QR reject: unknown QR type");
            return res.sendStatus(400);
        }

        
        // eslint-disable-next-line brace-style
        pendingTokens.find(t => { return t.token == token; })?.clear();

        res.sendStatus(200);
    } catch (e) {
        logger.error({ reqId, err: e }, "QR scan failed");
        res.sendStatus(400);
    }
});

export default router;