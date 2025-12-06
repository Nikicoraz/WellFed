import type { AuthenticatedRequest } from "../middleware/tokenChecker.js";
import Client from "../models/client.js";
import Notification from "../models/notification.js";
import type { Types } from "mongoose";
import clientOnly from "../middleware/clientOnly.js";
import express from "express";

const router = express.Router();

export async function sendNotification(shopLink: string, title: string, message: string, clientID: Types.ObjectId) {
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
}

router.get("/", clientOnly,  async(req, res) => {
    try {
        const areq = (req as AuthenticatedRequest).user;
    
        const user = await Client.findById(areq.id);
        if (!user) {
            res.sendStatus(401);
            return;
        }
    
        const notifications = user.notifications;
    
        const ret = [];
        for (const clientNotification of notifications) {
            const n = await Notification.findById(clientNotification.notification.toString());
            if (!n) {
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
        res.json(ret);
    } catch (e) {
        console.error(e);
        res.sendStatus(500);
    }
});

router.patch("/:id", clientOnly, async(req, res) => {
    try {
        const notificationID: string = req.params.id!;
        const areq = (req as AuthenticatedRequest).user;

        const user = await Client.findById(areq.id);

        if (!user) {
            res.sendStatus(401);
            return;
        }

        const result = await Client.updateOne({ 
            _id: user.id,
            "notifications.notification": notificationID
        }, {
            $set: { "notifications.$.viewed": true }
        });

        // Non ha aggiornato niente
        if (result.matchedCount == 0) {
            res.sendStatus(404);
            return;
        }

        res.sendStatus(200);
    } catch (e) {
        console.error(e);
        res.sendStatus(500);
    }

});

router.delete("/:id", clientOnly, async(req, res) => {
    try {
        const notificationID: string = req.params.id!;
        const areq = (req as AuthenticatedRequest).user;

        const result = await Client.updateOne({
            _id: areq.id
        },
        {
            $pull: {notifications: {notification: notificationID}} 
        });

        // Non ha aggiornato niente
        if (result.matchedCount == 0) {
            res.sendStatus(404);
            return;
        }

        const check = await Client.findOne({
            "notifications.notification": notificationID
        });

        // Non ci sono più riferimenti alla notifica
        if (!check) {
            await Notification.findByIdAndDelete(notificationID);
        }

        res.sendStatus(200);
    } catch (e) {
        console.error(e);
        res.sendStatus(500);
    }

});

export default router;