import jwt, { type JwtPayload } from "jsonwebtoken";
import type { Types } from "mongoose";
import express from "express";

export interface AuthenticatedRequest extends express.Request{
    user: JwtCustomPayload
}

export interface JwtCustomPayload extends JwtPayload{
    id: Types.ObjectId,
    email: string,
    username: string,
    client: boolean
}

const tokenChecker = (req: express.Request, res: express.Response, next: () => void) =>{
    if (!req.headers.authorization) {
        return res.sendStatus(401);
    }

    // Rimozione della parte iniziale del token
    const token = req.headers.authorization.split("Bearer ")[1];

    if (!token) {
        return res.sendStatus(401);
    }

    jwt.verify(token, process.env.PRIVATE_KEY!, (err, dec) =>{
        if (err) {
            return res.sendStatus(401);
        } else {
            // Eventuale set di parametri
            (req as AuthenticatedRequest).user = dec as JwtCustomPayload;
            next();
        }
    });
};

export default tokenChecker;