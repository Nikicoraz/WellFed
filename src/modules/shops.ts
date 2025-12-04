import Merchant from "../models/merchant.js";
import Product from "../models/product.js";
import express from "express";

const router = express.Router();
const imagePath = "/public/images/";

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
            res.sendStatus(400);
        } else {
            res.sendStatus(500);
        }
    }
});


router.get("/:id", async (req, res) => {
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
            image: `${imagePath}${shop.image}`
        });
    } catch (e) {
        console.log(e);
        if (e instanceof TypeError) {
            res.sendStatus(400);
        } else {
            res.sendStatus(500);
        }
    }
});

router.get("/:id/products", async (req, res) => {
    try {
        const shop = await Merchant.findById(req.params.id).exec();

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
                    id: product._id.toString(), // Usa '!' o controllo per Type safety in TS
                    name: product.name,
                    description: product.description,
                    origin: product.origin,
                    image: `${imagePath}${product.image}`,
                    points: product.points
                };
            })
        );
    } catch (e) {
        console.log(e);
        if (e instanceof TypeError) {
            res.sendStatus(400);
        } else {
            res.sendStatus(500);
        }
    }
});



router.get("/:shopId/products/:productId", async (req, res) => {
    try {
        const { shopId, productId } = req.params;

        const shop = await Merchant.findOne({
            _id: shopId,
            products: productId
        }).exec();

        if (!shop) {
            res.sendStatus(404);
            return;
        }

        const product = await Product.findById(productId).exec();

        if (!product) {
            res.sendStatus(404);
            return;
        }

        res.json({
            id: product._id.toString(),
            name: product.name,
            description: product.description,
            origin: product.origin,
            image: `${imagePath}${product.image}`,
            points: product.points
        });
    } catch (e) {
        console.log(e);
        if (e instanceof TypeError) {
            res.sendStatus(400);
        } else {
            res.sendStatus(500);
        }
    }
});


export default router;