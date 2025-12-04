import type { AuthenticatedRequest } from "./tokenChecker.js";
import express from "express";

const merchantOnly = (req: express.Request, res: express.Response, next: () => void) =>{
    const areq = req as AuthenticatedRequest;
    if (areq.user.client) {
        return res.sendStatus(400);
    }

    next();
};

export default merchantOnly;