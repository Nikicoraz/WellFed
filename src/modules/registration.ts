import Client from "../models/client.js";
import Merchant from "../models/merchant.js";
import argon from "argon2";
import express from "express";
import imageUtil from "../middleware/imageUtil.js";

const router = express.Router();
const simpleEmailRegex = /.+(\..+)?@.+\..{2,3}/;
const partitaIVARegex = /(IT)? ?\d{11}/;

router.post("/client", async(req, res) => {
    try {
        const username: string = req.body.username.trim();
        const email: string = req.body.email.trim();
        const password: string = req.body.password.trim();
    
        if (username != "" && email.match(simpleEmailRegex) && password != "") {
            const hashedPassword = await argon.hash(password);

            const client = new Client({
                username: username,
                password: hashedPassword,
                email: email,
            });
    
            if ((await Client.find({email: email}).exec()).length == 0 && (await Client.find({username: username}).exec()).length == 0) {
                await client.save();
                res.sendStatus(201);
            } else {
                res.sendStatus(409);
            }
        } else {
            res.sendStatus(400);
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