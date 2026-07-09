import Merchant from "../models/merchant.js";
import Prize from "../models/prize.js";
import Product from "../models/product.js";
import express from "express";
import { logger } from "./logger.js";

const router = express.Router();
const imagePath = "/public/images/";

const log = logger.child({
    scope: "shops"
});

router.get("", async(req, res) => {
    const reqId = req.headers["x-request-id"];

    try {
        log.info({ reqId }, "Fetch all shops request");

        const shops = await Merchant.find().exec();

        log.debug({ reqId, count: shops.length }, "Shops fetched from DB");

        const result = shops.map((shop) => {
            return {
                id: shop._id.toString(),
                name: shop.name,
                address: shop.address,
                image: `${imagePath}merchants/${shop.image}`
            };
        });

        res.json(result);

        log.info({ reqId, count: result.length }, "All shops returned");
    } catch (e) {
        log.error({ reqId, err: e }, "Failed to fetch all shops");
        res.sendStatus(500);
    }
});


router.get("/:shopID", async (req, res) => {
    const reqId = req.headers["x-request-id"];

    try {
        const shopId = req.params.shopID;

        log.info({ reqId, shopId}, "Fetch shop by ID");

        const shop = await Merchant.findById(shopId).exec();

        if (!shop) {
            log.warn({ reqId, shopId }, "Shop not found");
            res.sendStatus(404);
            return;
        }

        res.json({
            id: shop._id.toString(),
            name: shop.name,
            address: shop.address,
            image: `${imagePath}merchants/${shop.image}`
        });

        log.info({ reqId, shopId }, "Shop returned");
    } catch (e) {
        log.error({ reqId, err: e }, "Failed to fetch shop");
        res.sendStatus(500);
    }
});

router.get("/:shopID/products", async (req, res) => {
    const reqId = req.headers["x-request-id"];

    try {
        const shopId = req.params.shopID;

        log.info({ reqId, shopId }, "Fetch shop products");

        const shop = await Merchant.findById(shopId).exec();

        if (!shop) {
            log.warn({reqId, shopId }, "Shop not found (product)");
            res.sendStatus(404);
            return;
        }

        const productPromises = shop.products.map((productRef) => {
            return Product.findById(productRef).exec();
        });

        const resolvedProducts = await Promise.all(productPromises);        

        const products = resolvedProducts
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
            });
        
        log.info({ reqId, shopId, count: products.length }, "Shops products returned");

        res.json(products);
    } catch (e) {
        log.error({ reqId, err: e }, "Failed to fetch shop products");
        res.sendStatus(500);
    }
});

router.get("/:shopID/products/:productID", async (req, res) => {
    const reqId = req.headers["x-request-id"];

    try {
        const { shopID, productID } = req.params;
        
        log.info({ reqId, shopId: shopID, productId: productID }, "Fetch product in shop");

        const shop = await Merchant.findOne({
            _id: shopID,
            products: productID
        }).exec();

        if (!shop) {
            log.warn({ reqId, shopId: shopID, productID }, "Shop-product realtion not found");
            res.sendStatus(404);
            return;
        }

        const product = await Product.findById(productID).exec();

        if (!product) {
            log.warn({ reqId, productId: productID }, "Product not found");
            res.sendStatus(404);
            return;
        }

        const result = {
            id: product._id.toString(),
            name: product.name,
            description: product.description,
            origin: product.origin,
            image: `${imagePath}products/${product.image}`,
            points: product.points
        };

        log.info({ reqId, shopId: shopID, productId: productID }, "Product retruned");
        res.json(result);
    } catch (e) {
        log.error({ reqId, err: e}, "Failed to fetch product");
        res.sendStatus(500);
    }
});

router.get("/:shopID/prizes", async (req, res) => {
    const reqId = req.headers["x-request-id"];

    try {
        const shopId = req.params.shopID;

        log.info({reqId, shopId }, "Fetch shop prizes");

        const shop = await Merchant.findById(req.params.shopID).exec();


        if (!shop) {
            log.warn({ reqId, shopId }, "Shop not found (prizes)");
            res.sendStatus(404);
            return;
        }

        const prizesPromises = shop.prizes.map((prizeRef) => {
            return Prize.findById(prizeRef).exec();
        });

        const resolvedPrizes = await Promise.all(prizesPromises);

        const prizes = resolvedPrizes
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
            });

        log.info({ reqId, shopId, count: prizes.length }, "Shop prized returned");
        res.json(prizes);
    } catch (e) {
        log.error({ reqId, err: e }, "Failed to fetch shop prizes");
        res.sendStatus(500);
    }
});

router.get("/:shopID/prizes/:prizeID", async (req, res) => {
    const reqId = req.headers["x-request-id"] as string | undefined;

    try {
        const { shopID, prizeID } = req.params;

        log.info({ reqId, shopId: shopID, prizeId: prizeID }, "Fetch prize in shop");

        const shop = await Merchant.findOne({
            _id: shopID,
            prizes: prizeID
        }).exec();

        if (!shop) {
            log.warn({ reqId, shopId: shopID, prizeId: prizeID }, "Shop-prize relation not found");
            res.sendStatus(404);
            return;
        }

        const prize = await Prize.findById(prizeID).exec();

        if (!prize) {
            log.warn({ reqId, prizeId: prizeID }, "Prize not found");
            res.sendStatus(404);
            return;
        }

        const result = {
            id: prize._id.toString(),
            name: prize.name,
            description: prize.description,
            image: `${imagePath}prizes/${prize.image}`,
            points: prize.points
        };

        log.info({ reqId, shopId: shopID, prizeId: prizeID }, "Prize retunred");

        res.json(result);
    } catch (e) {
        log.error({ reqId, err: e }, "Failed to fetch prize");
        res.sendStatus(500);
    }
});

export default router;