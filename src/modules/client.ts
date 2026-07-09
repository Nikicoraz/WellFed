import { type AuthenticatedRequest, clientOnly } from "../middleware/authentication.js";
import Client from "../models/client.js";
import express from "express";
import { logger } from "./logger.js";

const router = express.Router();

const log = logger.child({
    tags: ["client"]
});

router.get("/", clientOnly, async(req, res) => {
    const reqId = (req.headers["x-request-id"] as string);

    try {
        const areq = (req as AuthenticatedRequest).user;

        log.debug({ reqId, userId: areq?.id }, "Client profile request");

        if (!areq) {
            log.warn({ reqId }, "Unauthorized: missing authenticated user");
            res.sendStatus(401);
            return;
        }
    
        const user = await Client.findById(areq.id);
        if (!user) {
            log.warn({ reqId, userId: areq.id }, "Client not found");
            res.sendStatus(401);
            return;
        }
    
        log.info({ reqId, userId: user._id }, "Client profile fetched"); // this gets printed twice for some reasons?

        res.json({
            id: user._id,
            username: user.username,
            email: user.email,
            points: user.points
        });
    } catch (e) {
        log.error({ reqId, err: e }, "Client profile handler failed");
        res.sendStatus(401);
    }
});


export default router;