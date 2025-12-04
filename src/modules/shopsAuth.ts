import Merchant from "../models/merchant.js";
import Prize from "../models/prize.js";
import Product from "../models/product.js";
import deleteImage from "../middleware/deleteImage.js";
import express from "express";
import uploadImage from "../middleware/uploadImage.js";

const router = express.Router();

router.post("/:shopId/products", uploadImage('products').single('image'), async (req, res) => {
    try {
        const uploadedImage = req.file;
        const name: string = req.body.name.trim();
        const description: string = req.body.description.trim();
        const origin: string = req.body.origin.trim();

        let points: number = 0;
        if (req.body.points) {
            points = req.body.points;
        }

        // Controllo per vedere se e' stata caricata un'immagine
        if (!uploadedImage) {
            res.sendStatus(400);
            return;
        }

        if (name == "" || description == "" || origin == "") {
            res.sendStatus(400);
            await deleteImage(`products/${uploadedImage.filename}`);
            return;
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
        await Merchant.findByIdAndUpdate(req.params.shopId, { $push: { products: newProductId } }).exec();

        res.sendStatus(201);

    } catch (e) {
        console.error(e);
        if (e instanceof TypeError) {
            res.sendStatus(400);
        } else {
            res.sendStatus(500);
        }
    }
});

router.patch("/:shopId/products/:productId", uploadImage('products').single('image'), async (req, res) => {
    try {
        const uploadedImage = req.file;
        const { name, description, origin, points } = req.body;

        const rollbackImageUpload = async () => {
            if (uploadedImage) {
                await deleteImage(`products/${uploadedImage.filename}`);
            }
        };

        const checkField = (field: string, updateCallBack: (s: string) => void) => {
            if (field) {
                field = field.trim();
                if (field == "") {
                    res.sendStatus(400);
                    rollbackImageUpload();
                    return;
                }

                updateCallBack(field);
            }
        };

        const shopId = req.params.shopId!;
        const productId = req.params.productId!;

        // Cerca il negozio il cui prodotto e' da aggiornare
        const shop = await Merchant.findOne({ 
            _id: shopId,
            products: productId 
        }).exec();

        // Se non esiste rollback
        if (!shop) {
            res.sendStatus(404);
            rollbackImageUpload();
            return;
        }

        // Cerca il prodotto da aggiornare
        const updatedProduct = await Product.findById(productId).exec();

        // Se non esiste rollback
        if (!updatedProduct) {
            res.sendStatus(404);
            rollbackImageUpload();
            return;
        }

        // Functional Programming Stuff
        const updateCallBackBuilder = (fieldName: string) => { 
            return async (field: string) => {
                await Product.findByIdAndUpdate(
                    productId,
                    { $set: { [fieldName]: field } }
                ).exec();
            };
        };
        
        // Controlla e aggiorna i campi
        checkField(name, updateCallBackBuilder("name"));
        checkField(description, updateCallBackBuilder("description"));
        checkField(origin, updateCallBackBuilder("origin"));
 
        if (points) {
            updatedProduct.points = points;
        }

        // Se e' stata caricata un'immagine
        if (uploadedImage) {
            // Bisogna cancellare l'immagine vecchia
            if (updatedProduct.image) {
                await deleteImage(`products/${updatedProduct.image}`);
            }
            updatedProduct.image = uploadedImage.filename;
        }

        await updatedProduct.save();
        res.sendStatus(200);

    } catch (e) {
        console.error(e);
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
            res.sendStatus(404);
            return;
        }

        const product = await Product.findById(productId);

        if (!product) {
            res.sendStatus(404);
            return;
        }

        if (product.image) {
            await deleteImage(`products/${product.image}`);
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
        console.error(e);
        if (e instanceof TypeError) {
            res.sendStatus(400);
        } else {
            res.sendStatus(500);
        }
    }
});

router.post("/:shopId/prizes", uploadImage('prizes').single('image'), async (req, res) => {
    try {
        const uploadedImage = req.file;
        const name: string = req.body.name.trim();
        const description: string = req.body.description.trim();

        let points: number = 0;
        if (req.body.points) {
            points = req.body.points;
        }

        // Controllo per vedere se e' stata caricata un'immagine
        if (!uploadedImage) {
            res.sendStatus(400);
            return;
        }

        if (name == "" || description == "") {
            res.sendStatus(400);
            await deleteImage(`prizes/${uploadedImage.filename}`);
            return;
        }

        const imagePath: string = uploadedImage.filename;

        const newPrize = new Prize({
            name: name,
            description: description,
            image: imagePath,
            points: points,
        });

        await newPrize.save();

        const newPrizeId = newPrize._id;
        await Merchant.findByIdAndUpdate(req.params.shopId, { $push: { prizes: newPrizeId } }).exec();

        res.sendStatus(201);

    } catch (e) {
        console.error(e);
        if (e instanceof TypeError) {
            res.sendStatus(400);
        } else {
            res.sendStatus(500);
        }
    }
});

router.patch("/:shopId/prizes/:prizeId", uploadImage('prizes').single('image'), async (req, res) => {
    try {
        const uploadedImage = req.file;
        const { name, description, points } = req.body;

        const rollbackImageUpload = async () => {
            if (uploadedImage) {
                await deleteImage(`prizes/${uploadedImage.filename}`);
            }
        };

        const checkField = (field: string, updateCallBack: (s: string) => void) => {
            if (field) {
                field = field.trim();
                if (field == "") {
                    res.sendStatus(400);
                    rollbackImageUpload();
                    return;
                }

                updateCallBack(field);
            }
        };

        const shopId = req.params.shopId!;
        const prizeId = req.params.prizeId!;

        // Cerca il negozio il cui premio e' da aggiornare
        const shop = await Merchant.findOne({ 
            _id: shopId,
            prizes: prizeId 
        }).exec();

        // Se non esiste rollback
        if (!shop) {
            res.sendStatus(404);
            rollbackImageUpload();
            return;
        }

        // Cerca il premio da aggiornare
        const updatedPrize = await Prize.findById(prizeId).exec();

        // Se non esiste rollback
        if (!updatedPrize) {
            res.sendStatus(404);
            rollbackImageUpload();
            return;
        }

        // Functional Programming Stuff
        const updateCallBackBuilder = (fieldName: string) => { 
            return async (field: string) => {
                await Prize.findByIdAndUpdate(
                    prizeId,
                    { $set: { [fieldName]: field } }
                ).exec();
            };
        };
        
        // Controlla e aggiorna i campi
        checkField(name, updateCallBackBuilder("name"));
        checkField(description, updateCallBackBuilder("description"));
 
        if (points) {
            updatedPrize.points = points;
        }

        // Se e' stata caricata un'immagine
        if (uploadedImage) {
            // Bisogna cancellare l'immagine vecchia
            if (updatedPrize.image) {
                await deleteImage(`prizes/${updatedPrize.image}`);
            }
            updatedPrize.image = uploadedImage.filename;
        }

        await updatedPrize.save();
        res.sendStatus(200);

    } catch (e) {
        console.error(e);
        if (e instanceof TypeError) {
            res.sendStatus(400);
        } else {
            res.sendStatus(500);
        }
    }
});

router.delete("/:shopId/prizes/:prizeId", async (req, res) => {
    try {
        const { shopId, prizeId } = req.params;

        const shop = await Merchant.findOne({ 
            _id: shopId, 
            prizes: prizeId 
        }).exec();

        if (!shop) {
            res.sendStatus(404);
            return;
        }

        const prize = await Prize.findById(prizeId);

        if (!prize) {
            res.sendStatus(404);
            return;
        }

        if (prize.image) {
            await deleteImage(`prizes/${prize.image}`);
        }

        await prize.deleteOne().exec();
        await Merchant.updateOne({ 
            _id: shopId,
            prize: prizeId
        }, { 
            $pull: { 
                prizes: prizeId 
            }
        }).exec();

        res.sendStatus(200);
    } catch (e) {
        console.error(e);
        if (e instanceof TypeError) {
            res.sendStatus(400);
        } else {
            res.sendStatus(500);
        }
    }
});

export default router;