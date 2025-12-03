import Merchant from "../models/merchant.js";
import Product from "../models/product.js";
import deleteImage from "../middleware/deleteImage.js";
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
            points = req.body.points;
        }

        if (name == "" || description == "" || origin == "") {
            res.sendStatus(400);
            return;
        }

        const uploadedImage = req.file;
        if (!uploadedImage) {
            return res.status(400);
        }

        const imagePath: string = uploadedImage.filename;

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
            image: product.image,
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

router.patch("/:shopId/products/:productId", async (req, res) => {
    try {
        const { shopId, productId } = req.params;

        const shop = await Merchant.findOne({ 
            _id: shopId, 
            products: productId 
        }).exec();

        if (!shop) {
            return res.sendStatus(404);
        }

        const updateFields: Record<string, unknown> = {};
        
        if (req.body.name) {
            const name: string = req.body.name.trim();
            if (name == "") {
                res.sendStatus(400);
                return;
            }
            updateFields["name"] = name;
        }

        if (req.body.description) {
            const description: string = req.body.description.trim();
            if (description == "") {
                res.sendStatus(400);
                return;
            }
            updateFields["description"] = description;
        }

        if (req.body.origin) {
            const origin: string = req.body.origin.trim();
            if (origin == "") {
                res.sendStatus(400);
                return;
            }
            updateFields["origin"] = origin;
        }

        if (req.body.description) {
            const description: string = req.body.description.trim();
            if (description == "") {
                res.sendStatus(400);
                return;
            }
            updateFields["description"] = description;
        }
        
        if (req.body.points) {
            const points: number = req.body.points;
            updateFields["points"] = points;
        }

        // Se non ci sono campi da aggiornare
        if (Object.keys(updateFields).length === 0) {
            res.sendStatus(400);
            return;
        }

        await Product.findByIdAndUpdate(
            productId,
            { $set: updateFields }
        ).exec();

        res.sendStatus(200);
    } catch (e) {
        console.log(e);
        if (e instanceof TypeError) {
            res.sendStatus(400);
        } else {
            res.sendStatus(500);
        }
    }
});

router.delete("/:shopId/products/:productId", async (req, res) => {
    try {
        const { shopId, productId } = req.params;

        const shop = await Merchant.findOne({ 
            _id: shopId, 
            products: productId 
        }).exec();

        if (!shop) {
            // Non so che errore dare
            res.sendStatus(404);
            return;
        }

        const product = await Product.findById(productId);

        if (!product) {
            // Non so che errore dare
            res.sendStatus(404);
            return;
        }

        if (product.image) {
            await deleteImage(product.image);
        }

        await product.deleteOne().exec();
        await Merchant.updateOne({ 
            _id: shopId,
            products: productId 
        }, { 
            $pull: { 
                products: productId 
            }
        }).exec();

        res.sendStatus(200);

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