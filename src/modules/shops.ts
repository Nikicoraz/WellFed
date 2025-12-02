import Merchant from "../models/merchant.js";
import Product from "../models/product.js";
import express from "express";
import uploadImage from "../middleware/uploadImage.js";

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
            image: shop.image
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
                    image: product.image,
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

router.post("/:id/products", uploadImage.single('image'), async (req, res) => {
    try {
        const name: string = req.body.name.trim();
        const description: string = req.body.description.trim();
        const origin: string = req.body.origin.trim();

        let points: number = 0;
        if (req.body.points) {
            points = parseInt(req.body.points.trim());
        }

        if (name == "" || description == "" || origin == "") {
            res.sendStatus(400);
            return;
        }

        const uploadedImage = req.file;
        if (!uploadedImage) {
            return res.status(400);
        }

        const imagePath: string = "/public/images/".concat(uploadedImage.filename);

        const newProduct = new Product({
            name: name,
            description: description,
            origin: origin,
            image: imagePath,
            points: points,
        });

        await newProduct.save();

        const newProductId = newProduct._id;
        console.log(newProductId);
        await Merchant.findByIdAndUpdate(req.params.id, { $push: { products: newProductId } }).exec();

        res.sendStatus(201);

    } catch (e) {
        console.log(e);
        if (e instanceof TypeError) {
            console.log("qua");
            res.sendStatus(400);
        } else {
            res.sendStatus(500);
        }
    }
});

export default router;