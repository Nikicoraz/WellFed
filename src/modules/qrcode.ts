import type { AuthenticatedRequest } from "../middleware/tokenChecker.js";
import Product from "../models/product.js";
import type { Types } from "mongoose";
import clientOnly from "../middleware/clientOnly.js";
import express from "express";
import jwt from "jsonwebtoken";
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

router.post("/assignPoints", merchantOnly, async (req, res) => {
    try {
        const authReq = req as AuthenticatedRequest;

        const array: AssignObject[] = req.body;
        let pointsSum = 0;
    
        for (const e of array) {
            // TODO: Controlla se i prodotti sono del commerciante che emana la richiesta
            const product = await Product.findById(e.productID);
            if (product) {
                pointsSum += product.points ?? 0;
            }
        }
    
        const payload: AssignmentQR = new AssignmentQR(array, pointsSum, authReq.user.id);

        // Il token scade in 2 minuti
        const token = jwt.sign({...payload}, process.env.PRIVATE_KEY!, {expiresIn: "2m"});
    
        qrcode.toDataURL(token, {type: "image/jpeg"}, (err, code) => {
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
            res.send(code);
        });

    } catch (e) {
        console.error(e);
        res.sendStatus(400);
    }
});

export default router;