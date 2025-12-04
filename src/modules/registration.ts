import Client from "../models/client.js";
import Merchant from "../models/merchant.js";
import argon from "argon2";
import express from 'express';

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
    
            if ((await Client.find({email: email}).exec()).length == 0 &&
                 (await Client.find({username: username}).exec()).length == 0) {
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
        console.log(e);
        if (e instanceof TypeError) {
            res.sendStatus(400);
        } else {
            res.sendStatus(500);
        }
    }
});

router.post("/merchant", async(req, res) => {
    try {
        const name: string = req.body.name.trim();
        const partitaIVA: string = req.body.partitaIVA.trim();
        const address: string = req.body.address.trim();
        const email: string = req.body.email.trim();
        const password: string = req.body.password.trim();

        if (name == "" || partitaIVA == "" || address == "" || !email.match(simpleEmailRegex) || password == "") {
            res.sendStatus(400);
            return;
        }

        if (!partitaIVA.match(partitaIVARegex)) {
            res.sendStatus(403);
            return;
        }

        if ((await Merchant.find({name: name}).exec()).length > 0 || (await Merchant.find({email: email}).exec()).length > 0) {
            res.sendStatus(409);
            return;
        }

        const hashedPassword = await argon.hash(password);
        const newMerchant = new Merchant({
            name: name,
            partitaIVA: partitaIVA,
            address: address,
            email: email,
            password: hashedPassword
        });

        await newMerchant.save();
        res.sendStatus(202);

    } catch (e) {
        if (e instanceof TypeError) {
            res.sendStatus(400);
        }
    }
});

export default router;