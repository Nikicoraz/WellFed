
import Transaction, { TransactionStatus, TransactionType } from "../models/transaction.js";
import type { AuthenticatedRequest } from "../middleware/authentication.js";
import type { Types } from "mongoose";
import express from "express";
import { logger } from "./logger.js";

const router = express.Router();

const log = logger.child({
    tags: ["transaction"]
});

export interface TransactionItems {
    products: {
        product: Types.ObjectId,
        quantity: number
    }[],
    prizes: Types.ObjectId[]
};

export async function logTransaction(
    issuerID: Types.ObjectId,
    receiverID: Types.ObjectId,
    points: number,
    type: TransactionType,
    status: TransactionStatus,
    items: TransactionItems,
    date: Date
) {
    await Transaction.create({
        issuerID,
        receiverID,
        points,
        transactionType: type,
        transactionStatus: status,
        items,
        issuingDate: date
    });
}


enum Entities {
    Merchant = "merchant",
    Client = "client"
}

router.get("/", async (req, res) => {
    const reqId = req.headers["x-request-id"];

    try {
        const areq: AuthenticatedRequest = req as AuthenticatedRequest;
        const userId = areq.user.id;

        log.info({ reqId, userId }, "Transaction history request");

        const search = await Transaction.find({
            $or: [
                { issuerID: areq.user.id },
                { receiverID: areq.user.id }
            ]
        });

        log.debug({ reqId, userId, count: search.length }, "Transaction fetched from DB");
        
        const userType: Entities = areq.user.client ? Entities.Client : Entities.Merchant;
        const otherEntity = userType == Entities.Client ? Entities.Merchant : Entities.Client;

        const result = search.map((transaction) => {
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
                issuingDate: transaction.issuingDate,
                items: transaction.items,
            };
        });

        log.info({ reqId, userId, returned: result.length }, "Transaction history returned");
        
        res.json(result);
    } catch (e) {
        log.error({ reqId, err: e }, "Transaction history failed");
        res.sendStatus(500);
    }
});

export default router;