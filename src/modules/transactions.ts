
import Transaction, { TransactionStatus, TransactionType } from "../models/transaction.js";
import type { AuthenticatedRequest } from "../middleware/tokenChecker.js";
import type { Types } from "mongoose";
import express from "express";

const router = express.Router();

export interface TransactionItems {
    products: {
        product: Types.ObjectId,
        quantity: number
    }[],
    prizes: Types.ObjectId[]
};

export async function logTransaction(
    issuerID: Types.ObjectId, receiverID: Types.ObjectId, points: number, type: TransactionType,
    status: TransactionStatus, items: TransactionItems) {

    const t = await Transaction.create({
        issuerID: issuerID,
        receiverID: receiverID,
        points: points,
        transactionType: type,
        transactionStatus: status,
        items: items
    });

    t.save();
}

enum Entities {
    Merchant = "merchant",
    Client = "client"
}

router.get("/", async (req, res) => {
    try {
        const areq: AuthenticatedRequest = req as AuthenticatedRequest;

        const search = await Transaction.find({
            $or: [
                { issuerID: areq.user.id },
                { receiverID: areq.user.id }
            ]
        });

        const userType: Entities = areq.user.client ? Entities.Client : Entities.Merchant;
        const otherEntity = userType == Entities.Client ? Entities.Merchant : Entities.Client;

        res.json(search.map(transaction => {
            let isIssuer: boolean;

            /* eslint-disable indent */
            switch (transaction.transactionType) {
                case TransactionType.PointAssignment:
                    isIssuer = userType == Entities.Merchant;
                    break;
                case TransactionType.PrizeRedeem:
                    isIssuer = userType == Entities.Client;
                    break;
                default:
                    isIssuer = false;
                    break;
            }

            return {
                issuerID: {
                    id: transaction.issuerID,
                    type: isIssuer ? userType : otherEntity
                },
                receiverID: {
                    id: transaction.receiverID,
                    type: isIssuer ? otherEntity : userType
                },
                points: transaction.points,
                transactionType: transaction.transactionType!.toString(),
                transactionStatus: transaction.transactionStatus!.toString(),
                items: transaction.items
            };
        }));
    } catch (e) {
        console.error(e);
        res.sendStatus(500);
    }
});

export default router;