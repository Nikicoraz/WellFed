import type { AuthenticatedRequest } from "../middleware/tokenChecker.js";
import Product from "../models/product.js";
import type { Types } from "mongoose";
import express from "express";
import jwt from "jsonwebtoken";
import qrcode from "qrcode";

const router = express.Router();

// TODO: Function generate QR Code

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

router.post("/assignPoints", async (req, res) => {
    try {
        const authReq = req as AuthenticatedRequest;

        const array: AssignObject[] = req.body;
        let pointsSum = 0;
    
        for (const e of array) {
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

export default router;