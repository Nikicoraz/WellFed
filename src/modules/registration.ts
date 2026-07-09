import { registeredClients, registeredMerchants } from "./prometheusClient.js";
import Client from "../models/client.js";
import Merchant from "../models/merchant.js";
import { OAuth2Client } from "google-auth-library";
import argon from "argon2";
import express from "express";
import imageUtil from "../middleware/imageUtil.js";
import { logger } from "./logger.js";

const router = express.Router();
const simpleEmailRegex = /.+(\..+)?@.+\..{2,3}/;
const partitaIVARegex = /(IT)? ?\d{11}/;
const passwordRegex = /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*\-_]).{8,40}$/;

const log = logger.child({
    tags: ["registration"]
});

router.post("/client", async(req, res) => {
    const reqId = req.headers["x-request-id"];

    try {
        const username: string = req.body.username.trim();
        const email: string = req.body.email.trim();
        const password: string = req.body.password.trim();
    
        log.info({ reqId, username, email }, "Client registration attempt");

        if (username == "" || !email.match(simpleEmailRegex) || password == "") {
            log.warn({ reqId, username, email }, "Client registration invalid payload");
            return res.sendStatus(400);
        }

        // La password non rispetta i requisiti minimi di complessità
        if (!password.match(passwordRegex)) {
            log.warn({ reqId, email }, "Client registration weak password");
            return res.sendStatus(400);
        }

        if (await Client.findOne({email: email}) || await Client.findOne({username: username}) || await Merchant.findOne({email: email})) {
            log.warn({ reqId, username, email }, "Client registration conflict");
            res.sendStatus(409);
            return;
        }

        const hashedPassword = await argon.hash(password);

        const client = new Client({
            username: username,
            password: hashedPassword,
            email: email,
            SSO: false,
        });

        await client.save();

        log.info({ reqId }, "Client registered");
        res.sendStatus(201);
    } catch (e) {
        // Nel caso non riesca ad accedere al body oppure al fare il trim alle opzioni, allora
        // è stata inviata una richiesta non valida

        log.error({ reqId }, "Client registration error");
        if (e instanceof TypeError) {
            res.sendStatus(400);
        } else {
            res.sendStatus(500);
        }
    }
});

router.post("/client/SSO", async(req, res) => {
    const reqId = req.headers["x-request-id"];

    const client = new OAuth2Client();
    try {
        const token = req.body.token.trim();

        log.info({ reqId }, "Client SSO registration attempt");

        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID!,
        });

        if (!ticket) {
            return res.sendStatus(401);
        }

        const payload = ticket.getPayload();

        if (!payload) {
            log.warn({ reqId }, "Client SSO invalid payload");
            return res.sendStatus(401);
        }

        const email = payload["email"];
        const username = payload["given_name"];

        if (!email || !username) {
            log.warn({ reqId }, "Client SSO missing fields");
            return res.sendStatus(400);
        }

        const user = await Client.findOne({
            email: email
        });

        const merchant = await Merchant.findOne({
            email: email
        });

        if ((user && !user.SSO) || merchant) {
            log.warn({ reqId, email }, "Client SSO blocked: local account exists");
            return res.sendStatus(422); // Esiste già un account con credenziali locali
        }

        if (user && user.SSO) {
            log.warn({ reqId, email }, "Client SSO conflict: already exists");
            return res.sendStatus(409); // Esiste già l'account
        }
        
        const newClient = new Client({
            username: username,
            password: "",
            email: email,
            SSO: true,
        });

        newClient.save();
        
        registeredClients.inc();
        log.info({ reqId, userId: newClient._id, email }, "Client SSO registered");

        res.sendStatus(201);
    } catch (e) {
        // Nel caso non riesca ad accedere al body oppure al fare il trim alle opzioni, allora
        // è stata inviata una richiesta non valida
        log.error({ reqId, err: e }, "Client SSO registration error");

        if (e instanceof TypeError) {
            res.sendStatus(401);
        } else {
            res.sendStatus(401);
        }
    }
});

router.post("/merchant", imageUtil.uploadImage('merchants').single('image'), async(req, res) => {
    const reqId = req.headers["x-request-id"];

    try {
        const uploadedImage = req.file;
        const name: string = req.body.name.trim();
        const partitaIVA: string = req.body.partitaIVA.trim();
        const address: string = req.body.address.trim();
        const email: string = req.body.email.trim();
        const password: string = req.body.password.trim();

        log.info({ reqId, name, email }, "Merchant registration attempt");

        // Immagine non presente
        if (!uploadedImage) {
            log.warn({ reqId, email }, "Merchant registration missing image");
            res.sendStatus(400);
            return;
        }

        // Campi vuoti
        if (name == "" || partitaIVA == "" || address == "" || !email.match(simpleEmailRegex) || password == "") {
            log.warn({ reqId, email }, "Merchant registration invalid payload");
            res.sendStatus(400);
            imageUtil.deleteImage(uploadedImage);
            return;
        }

        // PartitaIVA non valida
        if (!partitaIVA.match(partitaIVARegex)) {
            log.warn({ reqId, partitaIVA }, "Merchant registration invalid IVA");
            res.sendStatus(403);
            imageUtil.deleteImage(uploadedImage);
            return;
        }

        // La password non rispetta i criteri di sicurezza
        if (!password.match(passwordRegex)) {
            res.sendStatus(400);
            imageUtil.deleteImage(uploadedImage);
            log.warn({ reqId, email }, "Merchant registration weak password");
            return;
        }

        // Campi nome e email gia' presenti
        if ((await Merchant.find({name: name}).exec()).length > 0 || (await Merchant.find({email: email}).exec()).length > 0 || (await Client.findOne({email: email}))) {
            log.warn({ reqId, email, name }, "Merchant registration conflict");
            res.sendStatus(409);
            imageUtil.deleteImage(uploadedImage);
            return;
        }

        const hashedPassword = await argon.hash(password);
        const newMerchant = new Merchant({
            name: name,
            partitaIVA: partitaIVA,
            address: address,
            email: email,
            image: uploadedImage.filename,
            password: hashedPassword
        });

        await newMerchant.save();

        registeredMerchants.inc();
        log.info({ reqId, merchantId: newMerchant._id, email }, "Merchant registered");

        res.sendStatus(202);

    } catch (e) {
        log.error({ reqId, err: e }, "Merchant registration error");

        imageUtil.deleteImage(req.file);

        if (e instanceof TypeError) {
            res.sendStatus(400);
        } else {
            res.sendStatus(500);
        }
    }
});

export default router;