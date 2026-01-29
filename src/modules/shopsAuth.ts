import Merchant from "../models/merchant.js";
import Prize from "../models/prize.js";
import Product from "../models/product.js";
import express from "express";
import imageUtil from "../middleware/imageUtil.js";
import { shopOwnerOnly } from "../middleware/authentication.js";

const router = express.Router();

router.post("/:shopID/products", shopOwnerOnly, imageUtil.uploadImage('products').single('image'), async (req, res) => {
    try {
        const uploadedImage = req.file;
        const name: string = req.body.name.trim();
        const description: string = req.body.description.trim();
        const origin: string = req.body.origin.trim();
        const points: number = req.body.points ?? 0;

        // Immagine non presente
        if (!uploadedImage) {
            res.sendStatus(400);
            return;
        }

        // Campi vuoti
        if (name == "" || description == "" || origin == "") {
            res.sendStatus(400);
            imageUtil.deleteImage(uploadedImage);
            return;
        }

        // Controllo lo stesso se esiste il mercante, anche se dovrebbe essere garantito dal token
        const shop = await Merchant.findById(req.params.shopID).exec();

        if (!shop) {
            res.sendStatus(404);
            return;
        }
        
        const newProduct = new Product({
            name: name.trim(),
            description: description.trim(),
            origin: origin.trim(),
            image: uploadedImage.filename,
            points: points ?? 0,
            shopID: req.params.shopID
        });

        await newProduct.save();
        await Merchant.findByIdAndUpdate(req.params.shopID, { $push: { products: newProduct._id } }).exec();

        res.sendStatus(201);

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

router.patch("/:shopID/products/:productID", shopOwnerOnly, imageUtil.uploadImage('products').single('image'), async (req, res) => {
    try {
        const uploadedImage = req.file;
        const { shopID, productID } = req.params;
        const { name, description, origin, points } = req.body;

        // L'utilizzo di middleware fa si' che i tipi inferiti da req.params siano union "string | undefined"
        // Per non overcomplicare le cose viene utilizzato !

        // Negozio il cui prodotto e' da aggiornare
        const shop = await Merchant.findOne({ 
            _id: shopID!, 
            products: productID!
        }).exec();

        // Non esiste il negozio 
        if (!shop) {
            res.sendStatus(404);
            imageUtil.deleteImage(uploadedImage);
            return;
        }

        // Prodotto da aggiornare
        const updatedProduct = await Product.findById(productID).exec();

        // Non esiste il prodotto 
        if (!updatedProduct) {
            res.sendStatus(404);
            imageUtil.deleteImage(uploadedImage);
            return;
        }

        // Functional Programming Stuff
        const checkField = (field: string, updateCallBack: (s: string) => void) => {
            if (field) {
                field = field.trim();
                if (field == "") {
                    res.sendStatus(400);
                    imageUtil.deleteImage(uploadedImage);
                    return;
                }

                updateCallBack(field);
            }
        };

        const updateCallBackBuilder = (fieldName: string) => { 
            return async (field: string) => {
                await Product.findByIdAndUpdate(
                    productID,
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

        // Immagine aggiornata 
        if (uploadedImage) {
            // Esiste un'immagine vecchia 
            if (updatedProduct.image) {
                // Elimina l'immagine vecchia
                imageUtil.deleteImageFromPath(`products/${updatedProduct.image}`);
            }
            // Aggiorna il campo immagine
            updatedProduct.image = uploadedImage.filename;
        }

        await updatedProduct.save();
        res.sendStatus(200);

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

router.delete("/:shopID/products/:productID", shopOwnerOnly, async (req, res) => {
    try {
        const shopID = req.params.shopID!;
        const productID = req.params.productID!;

        // Negozio il cui prodotto e' da eliminare
        const shop = await Merchant.findOne({ 
            _id: shopID, 
            products: productID 
        }).exec();

        // Non esiste il negozio 
        if (!shop) {
            res.sendStatus(404);
            return;
        }

        // Prodotto da eliminare
        const product = await Product.findById(productID);

        // Non esiste il prodotto
        if (!product) {
            res.sendStatus(404);
            return;
        }

        // Il prodotto ha un'immagine
        if (product.image) {
            imageUtil.deleteImageFromPath(`products/${product.image}`);
        }
        
        // Eliminazione dalla lista dei prodotti del commericante
        await product.deleteOne().exec();
        await Merchant.updateOne({ 
            _id: shopID,
            products: productID 
        }, { 
            $pull: { 
                products: productID 
            }
        }).exec();

        res.sendStatus(200);
    } catch (e) {
        console.error(e);

        res.sendStatus(500);
    }
});

router.post("/:shopID/prizes", shopOwnerOnly, imageUtil.uploadImage('prizes').single('image'), async (req, res) => {
    try {
        const uploadedImage = req.file;
        const name: string = req.body.name.trim();
        const description: string = req.body.description.trim();
        const points: number = req.body.points ?? 0;

        // Immagine non presente
        if (!uploadedImage) {
            res.sendStatus(400);
            return;
        }

        // Campi vuoti
        if (name == "" || description == "") {
            res.sendStatus(400);
            imageUtil.deleteImage(uploadedImage);
            return;
        }

        const shop = await Merchant.findById(req.params.shopID).exec();

        if (!shop) {
            res.sendStatus(404);
            return;
        }

        const newPrize = new Prize({
            name: name.trim(),
            description: description.trim(),
            image: uploadedImage.filename,
            points: points ?? 0,
        });

        await newPrize.save();
        await Merchant.findByIdAndUpdate(req.params.shopID, { $push: { prizes: newPrize._id } }).exec();

        res.sendStatus(201);

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

router.patch("/:shopID/prizes/:prizeID", shopOwnerOnly, imageUtil.uploadImage('prizes').single('image'), async (req, res) => {
    try {
        const uploadedImage = req.file;
        const { shopID, prizeID } = req.params;
        const { name, description, points } = req.body;

        // L'utilizzo di middleware fa si' che i tipi inferiti da req.params siano union "string | undefined"
        // Per non overcomplicare le cose viene utilizzato !

        // Negozio il cui prodotto e' da aggiornare
        const shop = await Merchant.findOne({ 
            _id: shopID!, 
            prizes: prizeID!
        }).exec();

        // Non esiste il negozio 
        if (!shop) {
            res.sendStatus(404);
            imageUtil.deleteImage(uploadedImage);
            return;
        }

        // Prodotto da aggiornare
        const updatedPrize = await Prize.findById(prizeID).exec();

        // Non esiste il prodotto 
        if (!updatedPrize) {
            res.sendStatus(404);
            imageUtil.deleteImage(uploadedImage);
            return;
        }

        // Functional Programming Stuff
        const checkField = (field: string, updateCallBack: (s: string) => void) => {
            if (field) {
                field = field.trim();
                if (field == "") {
                    res.sendStatus(400);
                    imageUtil.deleteImage(uploadedImage);
                    return;
                }

                updateCallBack(field);
            }
        };

        const updateCallBackBuilder = (fieldName: string) => { 
            return async (field: string) => {
                await Prize.findByIdAndUpdate(
                    prizeID,
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

        // Immagine aggiornata 
        if (uploadedImage) {
            // Esiste un'immagine vecchia 
            if (updatedPrize.image) {
                // Elimina l'immagine vecchia
                imageUtil.deleteImageFromPath(`prizes/${updatedPrize.image}`);
            }
            // Aggiorna il campo immagine
            updatedPrize.image = uploadedImage.filename;
        }

        await updatedPrize.save();
        res.sendStatus(200);

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

router.delete("/:shopID/prizes/:prizeID", shopOwnerOnly, async (req, res) => {
    try {
        const shopID  = req.params.shopID!;
        const prizeID = req.params.prizeID!;

        // Negozio il cui prodotto e' da eliminare
        const shop = await Merchant.findOne({ 
            _id: shopID, 
            prizes: prizeID 
        }).exec();

        // Non esiste il negozio 
        if (!shop) {
            res.sendStatus(404);
            return;
        }

        // Prodotto da eliminare
        const prize = await Prize.findById(prizeID);

        // Non esiste il prodotto
        if (!prize) {
            res.sendStatus(404);
            return;
        }

        // Il prodotto ha un'immagine
        if (prize.image) {
            imageUtil.deleteImageFromPath(`prizes/${prize.image}`);
        }
        
        // Eliminazione dalla lista dei prodotti del commericante
        await prize.deleteOne().exec();
        await Merchant.updateOne({ 
            _id: shopID,
            prizes: prizeID 
        }, { 
            $pull: { 
                prizes: prizeID 
            }
        }).exec();

        res.sendStatus(200);
    } catch (e) {
        console.error(e);
        res.sendStatus(500);
    }
});

export default router;