import jwt, { type JwtPayload } from "jsonwebtoken";
import type { Types } from "mongoose";
import { activeUsers } from "../modules/prometheusClient.js";
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

class User {
    email: string;
    timeout: NodeJS.Timeout;

    constructor(email: string) {
        activeUsers.inc();

        this.email = email;
        this.timeout = setTimeout(() => {
            users = users.filter(e => {
                return e != this;
            });
            activeUsers.dec();
        }, 5 * 60 * 1000); // 5 minutes timeout
    }

    resetTimeout() {
        this.timeout.refresh();
    }
}

let users: User[] = [];

// Gli utenti attivi sono differenziati per email e non per token
function checkActiveUserStatus(email: string) {
    const user = users.find(e => {
        return e.email == email;
    });

    if (!user) {
        users.push(new User(email));
    } else {
        user.resetTimeout();
    }
}

export const clientOnly = (req: express.Request, res: express.Response, next: () => void) => {
    const areq = req as AuthenticatedRequest;
    if (!areq.user.client) {
        return res.sendStatus(400);
    }

    next();
};

export const merchantOnly = (req: express.Request, res: express.Response, next: () => void) => {
    const areq = req as AuthenticatedRequest;
    if (areq.user.client) {
        return res.sendStatus(400);
    }

    next();
};

export const shopOwnerOnly = (req: express.Request, res: express.Response, next: () => void) => {
    const areq = req as AuthenticatedRequest;
    if (!req.params.shopID || req.params.shopID != areq.user.id.toString()) {
        return res.sendStatus(401);
    }

    next();
};

export const tokenChecker = (req: express.Request, res: express.Response, next: () => void) => {
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
            checkActiveUserStatus((dec as JwtCustomPayload).email);
            next();
        }
    });
};