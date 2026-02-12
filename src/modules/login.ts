import jwt, { type SignOptions } from "jsonwebtoken";
import Client from "../models/client.js";
import type { JwtCustomPayload } from "../middleware/authentication.js";
import Merchant from "../models/merchant.js";
import { OAuth2Client } from "google-auth-library";
import argon from "argon2";
import express from "express";
import { sendNotification } from "./notifications.js";

const router = express.Router();
const simpleEmailRegex = /.+(\..+)?@.+\..{2,3}/;
const tokenOptions: SignOptions = {expiresIn: 86400};

router.post("", async(req, res) => {
    try {
        const email: string = req.body.email.trim();
        const password: string = req.body.password.trim();

        if (!email.match(simpleEmailRegex) || password == "") {
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
            }
        }

        if (!autenticated) {
            res.sendStatus(401);
            return;
        }

        const token = jwt.sign(payload!, process.env.PRIVATE_KEY!, tokenOptions);

        
        sendNotification("null", "Nuovo Login", `Hai effettuato un login in data ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, user!._id);
        res.json({token: token});
    } catch (e) {
        console.error(e);
        if (e instanceof TypeError) {
            res.sendStatus(401);
        } else {
            res.sendStatus(500);
        }
    }
});


router.post("/SSO", async (req, res) => {
    const client = new OAuth2Client();
    let token = req.body.token;

    if (!token) {
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
            return res.sendStatus(401);
        }

        const user = await Client.findOne({
            email: payload["email"]!,
            SSO: true
        });

        if (!user) {
            return res.sendStatus(401);
        }

        const jwtPayload: JwtCustomPayload = {
            id: user._id,
            email: user.email!,
            username: user.username!,
            client: true
        };

        const jwtToken = jwt.sign(jwtPayload, process.env.PRIVATE_KEY!, tokenOptions);
        sendNotification("null", "Nuovo Login", `Hai effettuato un login in data ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, user!._id);
        res.location("/");
        res.json({token: jwtToken});
    } catch (e) {
        // Registrazione fallita
        res.sendStatus(400);

        // TODO: Potrebbe non essere necessario loggare l'errore a console per ogni autenticazione fallita
        console.error(e);
    }
});

export default router;