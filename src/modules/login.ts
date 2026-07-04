import jwt, { type SignOptions } from "jsonwebtoken";
import { loginAttempts, loginErrors, loginSuccess } from "./prometheusClient.js";
import Client from "../models/client.js";
import type { JwtCustomPayload } from "../middleware/authentication.js";
import Merchant from "../models/merchant.js";
import { OAuth2Client } from "google-auth-library";
import argon from "argon2";
import express from "express";
import { logger } from "./logger.js";
import { sendNotification } from "./notifications.js";

const router = express.Router();
const simpleEmailRegex = /.+(\..+)?@.+\..{2,3}/;
const tokenOptions: SignOptions = {expiresIn: 86400};

router.post("", async(req, res) => {
    const reqId = (req.headers["x-request-id"] as string);
    
    try {
        const email: string = req.body.email.trim();
        const password: string = req.body.password.trim();
        
        loginAttempts.inc();
        logger.info({ reqId, email }, "Login attempt");

        if (!email.match(simpleEmailRegex) || password == "") {
            loginErrors.inc();
            logger.warn({ reqId, email }, "Invalid login payload");
            res.sendStatus(401);
            return;
        }

        let user;
        let payload: JwtCustomPayload | null = null;
        let autenticated = false;
        if ((user = await Client.findOne({email: email, SSO: false}))) {
            if (await argon.verify(user.password!, password)) {
                payload = {
                    id: user._id,
                    email: user.email!,
                    username: user.username!,
                    client: true
                };
                res.location("/");
                autenticated = true;
                loginSuccess.inc();
                logger.info({ reqId, userId: user._id }, "Client authenticated");
            } else {
                loginErrors.inc();
                logger.warn({ reqId, userId: user._id }, "Client password mismatch");
            }
        } else if ((user = await Merchant.findOne({email: email}).exec())) {
            if (await argon.verify(user.password!, password)) {
                payload = {
                    id: user._id,
                    email: user.email!,
                    username: user.name!,
                    client: false
                };
                res.location("/shop/" + user._id);
                autenticated = true;
                loginSuccess.inc();
                logger.info({ reqId, userId: user._id }, "Merchant authenticated");
            } else {
                loginErrors.inc();
                logger.warn({ reqId, userId: user._id }, "Merchant password mismatch");
            }
        }

        if (!autenticated || !payload) {
            loginErrors.inc();
            logger.warn({ reqId, email }, "Authentication failed");
            res.sendStatus(401);
            return;
        }

        const token = jwt.sign(payload, process.env.PRIVATE_KEY!, tokenOptions);

        loginSuccess.inc();
        logger.info({ reqId, userId: payload.id }, "JWT issued");

        sendNotification("null", "Nuovo Login", `Hai effettuato un login in data ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, user!._id);
        res.json({token: token});
    } catch (e) {
        logger.error({ reqId, err: e }, "Login handler crash");
        console.error(e);
        if (e instanceof TypeError) {
            res.sendStatus(401);
        } else {
            res.sendStatus(500);
        }
    }
});


router.post("/SSO", async (req, res) => {
    const reqId = (req.headers["x-request-id"] as string);
    loginAttempts.inc();
    
    const client = new OAuth2Client();
    let token = req.body.token;

    if (!token) {
        loginErrors.inc();
        logger.warn({ reqId }, "SSO missing token");
        res.sendStatus(400);
        return;
    }

    try {
        token = token.trim();
        // Se la verifica fallisce lancia un'eccezione
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID!
        });
    
        const payload = ticket.getPayload();
        if (!payload) {
            loginErrors.inc();
            logger.warn({ reqId }, "SSO invalid payload");
            res.sendStatus(401);
            return;
        }

        const user = await Client.findOne({
            email: payload["email"]!,
            SSO: true
        });

        if (!user) {
            loginErrors.inc();
            logger.warn({ reqId, email: payload.email }, "SSO user not found");
            res.sendStatus(401);
            return;
        }

        const jwtPayload: JwtCustomPayload = {
            id: user._id,
            email: user.email!,
            username: user.username!,
            client: true
        };

        const jwtToken = jwt.sign(jwtPayload, process.env.PRIVATE_KEY!, tokenOptions);
        
        loginSuccess.inc();
        logger.info({ reqId, userId: user._id }, "SSO login success");
        
        sendNotification("null", "Nuovo Login", `Hai effettuato un login in data ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, user!._id);
        res.location("/");
        res.json({token: jwtToken});
    } catch (e) {
        logger.warn({ reqId, err: e }, "SSO authentication failed"); //should this be an error instead? mmmmmhm
        // Registrazione fallita
        res.sendStatus(400);
    }
});

export default router;