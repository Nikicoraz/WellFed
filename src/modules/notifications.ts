import { type AuthenticatedRequest, clientOnly } from "../middleware/authentication.js";
import Client from "../models/client.js";
import Notification from "../models/notification.js";
import type { Types } from "mongoose";
import express from "express";
import { logger } from "./logger.js";

const router = express.Router();

export async function sendNotification(shopLink: string, title: string, message: string, clientID: Types.ObjectId) {
    try {
        const newNotification = new Notification({
            shopLink: shopLink,
            title: title,
            notificationMessage: message
        });

        await newNotification.save();

        await Client.findByIdAndUpdate(clientID, {
            $push: {
                notifications: {
                    notification: newNotification.id,
                    viewed: false
                }
            }
        });
    } catch (e) {
        logger.error({ err: e, clientID }, "Notification creation failed");
    }
}

router.get("/", clientOnly,  async(req, res) => {
    const reqId = req.headers["x-request-id"];

    try {
        const areq = (req as AuthenticatedRequest).user;
    
        const user = await Client.findById(areq.id);
        if (!user) {
            res.sendStatus(401);
            return;
        }
    
        logger.debug({ reqId, userId: areq.id }, "Fetching notifications");
        
        const notifications = user.notifications;
    
        const ret = [];
        for (const clientNotification of notifications) {
            const n = await Notification.findById(clientNotification.notification.toString());
            if (!n) {
                logger.warn({ reqId, notificationId: clientNotification.notification }, "Missing notification reference");
                return;
            }
    
            ret.push({
                id: n._id,
                shopLink: n.shopLink,
                viewed: clientNotification.viewed,
                title: n.title,
                notificationMessage: n.notificationMessage
            });
        }

        logger.info({ userId: areq.id, count: ret.length }, "Notification fetched");

        res.json(ret);
    } catch (e) {
        logger.error({ err: e }, "Notification GET failed");
        res.sendStatus(500);
    }
});

router.patch("/:id", clientOnly, async(req, res) => {
    const reqId = req.headers["x-request-id"];

    try {
        const notificationID: string = req.params.id! as string;
        const areq = (req as AuthenticatedRequest).user;


        const result = await Client.updateOne({ 
            _id: areq.id,
            "notifications.notification": notificationID
        }, {
            $set: { "notifications.$.viewed": true }
        });

        // Non ha aggiornato niente
        if (result.matchedCount == 0) {
            logger.warn({ reqId, notificationID }, "Notification not found for update");
            res.sendStatus(404);
            return;
        }

        logger.info({ reqId, userId: areq.id, notificationID }, "Notification marked viewed");
        res.sendStatus(200);
    } catch (e) {
        logger.error({ err: e }, "Notification PATCH failed");
        res.sendStatus(500);
    }

});

router.delete("/:id", clientOnly, async(req, res) => {
    try {
        const notificationID: string = req.params.id! as string;
        const areq = (req as AuthenticatedRequest).user;

        const result = await Client.updateOne({
            _id: areq.id
        },
        {
            $pull: {notifications: {notification: notificationID}} 
        });

        // Non ha aggiornato niente
        if (result.matchedCount == 0) {
            logger.warn({ userId: areq.id }, "Notification delete not matched");
            res.sendStatus(404);
            return;
        }

        const check = await Client.findOne({
            "notifications.notification": notificationID
        });

        // Non ci sono più riferimenti alla notifica
        if (!check) {
            await Notification.findByIdAndDelete(notificationID);
            logger.info({ notificationID }, "Orphan notification deleted");
        }

        res.sendStatus(200);
    } catch (e) {
        logger.error({ err: e }, "Notification DELETE failed");
        res.sendStatus(500);
    }

});

export default router;