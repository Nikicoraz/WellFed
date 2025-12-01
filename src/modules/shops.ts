import Merchant from "../models/merchant.js";
import express from "express";

const router = express.Router();

router.get("", async(req, res) => {
    try {
        const shops = await Merchant.find().exec();
        res.json(shops.map((shop) => {
            return {
                id: shop._id.toString(),
                name: shop.name,
                address: shop.address,
                image: shop.image
            };
        }));
    } catch (e) {
        console.log(e);
        if (e instanceof TypeError) {
            res.sendStatus(401);
        } else {
            res.sendStatus(500);
        }
    }
});


router.get(":id", async (req, res) => {
    try {
        const shop = await Merchant.findById(req.params.id).exec();

        if (!shop) {
            res.sendStatus(404);
            return;
        }

        res.json({
            id: shop._id.toString(),
            name: shop.name,
            address: shop.address,
            image: shop.image
        });
    } catch (e) {
        console.log(e);
        if (e instanceof TypeError) {
            res.sendStatus(401);
        } else {
            res.sendStatus(500);
        }
    }
});
