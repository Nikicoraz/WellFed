import type { AuthenticatedRequest } from "../middleware/tokenChecker.js";
import Client from "../models/client.js";
import clientOnly from "../middleware/clientOnly.js";
import express from "express";

const router = express.Router();

router.get("/", clientOnly, async(req, res) => {
    try {
        const areq = (req as AuthenticatedRequest).user;
        if (!areq) {
            res.sendStatus(401);
            return;
        }
    
        const user = await Client.findById(areq.id);
        if (!user) {
            res.sendStatus(401);
            return;
        }
    
        res.json({
            id: user._id,
            username: user.username,
            email: user.email,
            points: user.points
        });
    } catch (e) {
        console.error(e);
        res.sendStatus(401);
    }
});


export default router;