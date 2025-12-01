import jwt, { type SignOptions } from "jsonwebtoken";
import Client from "../models/client.js";
import Merchant from "../models/merchant.js";
import argon from "argon2";
import express from 'express';

const router = express.Router();
const simpleEmailRegex = /.+(\..+)?@.+\..{2,3}/;
const tokenOptions: SignOptions = {expiresIn: 86400};

router.post('', async(req, res) => {
    try{
        const email: string = req.body.email.trim();
        const password: string = req.body.password.trim();

        if(!email.match(simpleEmailRegex) || password == "") {
            res.sendStatus(401);
            return;
        }

        let user;
        let payload = {};
        let autenticated = false;
        if((user = await Client.findOne({email: email}).exec())) {
            if(await argon.verify(user.password!, password)) {
                payload = {
                    id: user._id,
                    email: user.email,
                    username: user.username
                };
                res.location("/");
                autenticated = true;
            }
        }else if((user = await Merchant.findOne({email: email}).exec())) {
            if(await argon.verify(user.password!, password)) {
                payload = {
                    id: user._id,
                    email: user.email,
                    username: user.name
                };
                res.location("/shop/" + user._id);
                autenticated = true;
            }
        }

        if(!autenticated) {
            res.sendStatus(401);
            return;
        }

        const token = jwt.sign(payload, process.env.PRIVATE_KEY!, tokenOptions);

        res.json({token: token}).send();
    }catch (e) {
        if(e instanceof TypeError) {
            res.sendStatus(401);
        }else{
            res.sendStatus(500);
        }
    }
});

export default router;