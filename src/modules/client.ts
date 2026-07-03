import { type AuthenticatedRequest, clientOnly } from "../middleware/authentication.js";
import Client from "../models/client.js";
import express from "express";
import { logger } from "./logger.js";

const router = express.Router();

router.get("/", clientOnly, async(req, res) => {
    const reqId = (req.headers["x-request-id"] as string);

    try {
        const areq = (req as AuthenticatedRequest).user;

        logger.debug({ reqId, userId: areq?.id }, "Client profile request");

        if (!areq) {
            logger.warn({ reqId }, "Unauthorized: missing authenticated user");
            res.sendStatus(401);
            return;
        }
    
        const user = await Client.findById(areq.id);
        if (!user) {
            logger.warn({ reqId, userId: areq.id }, "Client not found");
            res.sendStatus(401);
            return;
        }
    
        logger.info({ reqId, userId: user._id }, "Client profile fetched"); // this gets printed twice for some reasons?

        res.json({
            id: user._id,
            username: user.username,
            email: user.email,
            points: user.points
        });
    } catch (e) {
        logger.error({ reqId, err: e }, "Client profile handler failed");
        console.error(e);
        res.sendStatus(401);
    }
});


export default router;