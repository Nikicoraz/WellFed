import { TransactionStatus, TransactionType } from "../models/transaction.js";
import type { AuthenticatedRequest } from "../middleware/tokenChecker.js";
import Client from "../models/client.js";
import Merchant from "../models/merchant.js";
import Prize from "../models/prize.js";
import Product from "../models/product.js";
import type { Types } from "mongoose";
import clientOnly from "../middleware/clientOnly.js";
import express from "express";
import jwt from "jsonwebtoken";
import { logTransaction } from "./transactions.js";
import merchantOnly from '../middleware/merchantOnly.js';
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

let pendingTokens: string[] = [];
function addPendingToken(token: string) {
    pendingTokens.push(token);
    setTimeout(() => {
        pendingTokens = pendingTokens.filter((e) => {
            return e != token;
        });
    }, (1000 * 60 * 2));
}

router.post("/assignPoints", merchantOnly, async (req, res) => {
    try {
        const authReq = req as AuthenticatedRequest;

        const array: AssignObject[] = req.body;
        let pointsSum = 0;
    
        for (const e of array) {
            const product = await Product.findById(e.productID);
            if (product) {
                pointsSum += (product.points ?? 0) * e.quantity;
            }
        }
    
        const payload: AssignmentQR = new AssignmentQR(array, pointsSum, authReq.user.id);

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

router.post("/redeemPrize", clientOnly, (req, res) => {
    try {
        const authReq = req as AuthenticatedRequest;

        const prizeID = req.body.prizeID.trim();
        if (prizeID == "") {
            return res.sendStatus(400);
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
    try {
        const authReq = req as AuthenticatedRequest;

        const token: string = req.body.token.trim();
        const payload = jwt.verify(token, process.env.PRIVATE_KEY!);
        const qrPayload = payload as QR;

        if (!pendingTokens.includes(token)) { 
            res.sendStatus(400);
            return;
        }

        if (qrPayload.type == QRTypes.Assignment && authReq.user.client) {
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
                res.sendStatus(400);
                return;
            }


            const client = await Client.findById(clientID);
            if (!client) {
                // ID falso
                res.sendStatus(400);
                return;
            }
            const pointsString = `points.${shopID}`;
            const oldPoints: number = client.get(pointsString) || 0;
            client.set(pointsString, oldPoints + points);
            client.save();

            // Non serve aspettare la fine della funzione
            logTransaction(shopID, clientID, points, TransactionType.PointAssignment, TransactionStatus.Success, {
                prizes: [],
                products: productQuantityList
            }, new Date());

            // Update finished

        } else if (qrPayload.type == QRTypes.Redeem && !authReq.user.client) {
            const shopID = authReq.user.id;
            const clientID = (qrPayload as RedeemQR).clientID;
            const prizeID = (qrPayload as RedeemQR).prizeID;

            const shop = await Merchant.findOne({
                _id: shopID,
                prizes: prizeID
            });

            // Nel caso lo shop non abbia il premio
            if (!shop) {
                res.sendStatus(400);
                return;
            }

            const prize = await Prize.findById(prizeID);
            if (!prize) {
                // What???
                res.sendStatus(400);
                return;
            }

            // Scala i punti dall'utente
            const client = await Client.findById(clientID);
            if (!client) {
                // Id falso
                res.sendStatus(400);
                return;
            }

            const pointPath = `points.${shopID}`;
            const currentPoints: number = client.get(pointPath);
            if (currentPoints - prize.points! < 0) {
                res.sendStatus(402);
                return;
            }
            
            client.set(pointPath, currentPoints - prize.points!);
            client.save();
            logTransaction(clientID, shopID, prize.points!, TransactionType.PrizeRedeem, TransactionStatus.Success, {
                prizes: [prizeID],
                products: []
            }, new Date());

        } else {
            return res.sendStatus(400);
        }


        pendingTokens = pendingTokens.filter((e) =>{
            return e != token;
        });
        res.sendStatus(200);
    } catch (e) {
        console.error(e);
        res.sendStatus(400);
    }
});

export default router;