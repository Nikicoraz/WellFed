import Client from "../models/client.js";
import Merchant from "../models/merchant.js";
import { OAuth2Client } from "google-auth-library";
import argon from "argon2";
import express from "express";
import imageUtil from "../middleware/imageUtil.js";

const router = express.Router();
const simpleEmailRegex = /.+(\..+)?@.+\..{2,3}/;
const partitaIVARegex = /(IT)? ?\d{11}/;
const passwordRegex = /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*\-_]).{8,40}$/;

router.post("/client", async(req, res) => {
    try {
        const username: string = req.body.username.trim();
        const email: string = req.body.email.trim();
        const password: string = req.body.password.trim();
    
        if (username == "" || !email.match(simpleEmailRegex) || password == "") {
            return res.sendStatus(400);
        }

        // La password non rispetta i requisiti minimi di complessità
        if (!password.match(passwordRegex)) {
            return res.sendStatus(400);
        }

        const hashedPassword = await argon.hash(password);

        const client = new Client({
            username: username,
            password: hashedPassword,
            email: email,
            SSO: false,
        });

        if (!(await Client.findOne({email: email})) && !(await Client.findOne({username: username}))) {
            await client.save();
            res.sendStatus(201);
        } else {
            res.sendStatus(409);
        }
    } catch (e) {
        // Nel caso non riesca ad accedere al body oppure al fare il trim alle opzioni, allora
        // è stata inviata una richiesta non valida
        console.error(e);
        if (e instanceof TypeError) {
            res.sendStatus(400);
        } else {
            res.sendStatus(500);
        }
    }
});

router.post("/client/SSO", async(req, res) => {
    const client = new OAuth2Client();
    try {
        const token = req.body.token.trim();
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID!,
        });

        if (!ticket) {
            return res.sendStatus(401);
        }

        const payload = ticket.getPayload();

        if (!payload) {
            return res.sendStatus(401);
        }

        const email = payload["email"];
        const username = payload["given_name"];

        if (!email || !username) {
            return res.sendStatus(400);
        }

        const user = await Client.findOne({
            email: email
        });

        if (user && user.SSO) {
            return res.sendStatus(422); // Esiste già un account con credenziali locali
        }

        if (user && !user.SSO) {
            return res.sendStatus(409); // Esiste già l'account
        }
        
        const newClient = new Client({
            username: username,
            password: "",
            email: email,
            SSO: true,
        });

        newClient.save();
        res.sendStatus(201);
    } catch (e) {
        // Nel caso non riesca ad accedere al body oppure al fare il trim alle opzioni, allora
        // è stata inviata una richiesta non valida
        console.error(e);
        if (e instanceof TypeError) {
            res.sendStatus(400);
        } else {
            res.sendStatus(401);
        }
    }
});

router.post("/merchant", imageUtil.uploadImage('merchants').single('image'), async(req, res) => {
    try {
        const uploadedImage = req.file;
        const name: string = req.body.name.trim();
        const partitaIVA: string = req.body.partitaIVA.trim();
        const address: string = req.body.address.trim();
        const email: string = req.body.email.trim();
        const password: string = req.body.password.trim();

        // Immagine non presente
        if (!uploadedImage) {
            res.sendStatus(400);
            return;
        }

        // Campi vuoti
        if (name == "" || partitaIVA == "" || address == "" || !email.match(simpleEmailRegex) || password == "") {
            res.sendStatus(400);
            imageUtil.deleteImage(uploadedImage);
            return;
        }

        // PartitaIVA non valida
        if (!partitaIVA.match(partitaIVARegex)) {
            res.sendStatus(403);
            imageUtil.deleteImage(uploadedImage);
            return;
        }

        // La password non rispetta i criteri di sicurezza
        if (!password.match(passwordRegex)) {
            return res.sendStatus(400);
        }

        // Campi nome e email gia' presenti
        if ((await Merchant.find({name: name}).exec()).length > 0 || (await Merchant.find({email: email}).exec()).length > 0) {
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
        res.sendStatus(202);

    } catch (e) {
        console.error(e);
        imageUtil.deleteImage(req.file);

        if (e instanceof TypeError) {
            res.sendStatus(400);
        } else {
            res.sendStatus(500);
        }
    }
});

export default router;