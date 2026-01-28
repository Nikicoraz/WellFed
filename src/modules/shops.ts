import Merchant from "../models/merchant.js";
import Prize from "../models/prize.js";
import Product from "../models/product.js";
import express from "express";

const router = express.Router();
const imagePath = "/public/images/";

router.get("", async(_, res) => {
    try {
        const shops = await Merchant.find().exec();
        res.json(shops.map((shop) => {
            return {
                id: shop._id.toString(),
                name: shop.name,
                address: shop.address,
                image: `${imagePath}merchants/${shop.image}`
            };
        }));
    } catch (e) {
        console.error(e);
        res.sendStatus(500);
    }
});


router.get("/:shopID", async (req, res) => {
    try {
        const shop = await Merchant.findById(req.params.shopID).exec();
        if (!shop) {
            res.sendStatus(404);
            return;
        }

        res.json({
            id: shop._id.toString(),
            name: shop.name,
            address: shop.address,
            image: `${imagePath}merchants/${shop.image}`
        });
    } catch (e) {
        console.error(e);
        res.sendStatus(500);
    }
});

router.get("/:shopID/products", async (req, res) => {
    try {
        const shop = await Merchant.findById(req.params.shopID).exec();

        if (!shop) {
            res.sendStatus(404);
            return;
        }

        const productPromises = shop.products.map((productRef) => {
            return Product.findById(productRef).exec();
        });

        const resolvedProducts = await Promise.all(productPromises);        

        res.json(resolvedProducts
            .filter((product) => {
                return product !== null;    
            })
            .map((product) => {
                return {
                    id: product._id.toString(),
                    name: product.name,
                    description: product.description,
                    origin: product.origin,
                    image: `${imagePath}products/${product.image}`,
                    points: product.points
                };
            })
        );
    } catch (e) {
        console.error(e);
        res.sendStatus(500);
    }
});

router.get("/:shopID/products/:productID", async (req, res) => {
    try {
        const { shopID, productID } = req.params;

        const shop = await Merchant.findOne({
            _id: shopID,
            products: productID
        }).exec();

        if (!shop) {
            res.sendStatus(404);
            return;
        }

        const product = await Product.findById(productID).exec();

        if (!product) {
            res.sendStatus(404);
            return;
        }

        res.json({
            id: product._id.toString(),
            name: product.name,
            description: product.description,
            origin: product.origin,
            image: `${imagePath}products/${product.image}`,
            points: product.points
        });
    } catch (e) {
        console.error(e);
        res.sendStatus(500);
    }
});

router.get("/:shopID/prizes", async (req, res) => {
    try {
        const shop = await Merchant.findById(req.params.shopID).exec();

        if (!shop) {
            res.sendStatus(404);
            return;
        }

        const prizesPromises = shop.prizes.map((prizeRef) => {
            return Prize.findById(prizeRef).exec();
        });

        const resolvedPrizes = await Promise.all(prizesPromises);

        res.json(resolvedPrizes
            .filter((prize) => {
                return prize !== null;    
            })
            .map((prize) => {
                return {
                    id: prize._id.toString(), // Usa '!' o controllo per Type safety in TS
                    name: prize.name,
                    description: prize.description,
                    image: `${imagePath}prizes/${prize.image}`,
                    points: prize.points
                };
            })
        );
    } catch (e) {
        console.error(e);
        res.sendStatus(500);
    }
});

router.get("/:shopID/prizes/:prizeID", async (req, res) => {
    try {
        const { shopID, prizeID } = req.params;

        const shop = await Merchant.findOne({
            _id: shopID,
            prizes: prizeID
        }).exec();

        if (!shop) {
            res.sendStatus(404);
            return;
        }

        const prize = await Prize.findById(prizeID).exec();

        if (!prize) {
            res.sendStatus(404);
            return;
        }

        res.json({
            id: prize._id.toString(),
            name: prize.name,
            description: prize.description,
            image: `${imagePath}prizes/${prize.image}`,
            points: prize.points
        });

    } catch (e) {
        console.error(e);
        res.sendStatus(500);
    }
});

export default router;