import Merchant from "../models/merchant.js";
import Prize from "../models/prize.js";
import Product from "../models/product.js";
import express from "express";
import imageUtil from "../middleware/imageUtil.js";
import { logger } from "./logger.js";
import { shopOwnerOnly } from "../middleware/authentication.js";

const router = express.Router();

const log = logger.child({
    tags: ["shopsAuth"]
});

router.post("/:shopID/products", shopOwnerOnly, imageUtil.uploadImage('products').single('image'), async (req, res) => {
    const reqId = req.headers["x-request-id"];
    try {
        const uploadedImage = req.file;
        const name: string = req.body.name.trim();
        const description: string = req.body.description.trim();
        const origin: string = req.body.origin.trim();
        const points: number = req.body.points ?? 0;

        const shopId = req.params.shopID;

        log.info({ reqId, shopId, name }, "Product creation request");

        // Immagine non presente
        if (!uploadedImage) {
            log.warn({ reqId }, "Product creation missing image");
            res.sendStatus(400);
            return;
        }

        // Campi vuoti
        if (name == "" || description == "" || origin == "") {
            log.warn({ reqId, shopId }, "Product creation invalid fields");
            imageUtil.deleteImage(uploadedImage);
            res.sendStatus(400);
            return;
        }

        // Controllo lo stesso se esiste il mercante, anche se dovrebbe essere garantito dal token
        const shop = await Merchant.findById(req.params.shopID).exec();

        if (!shop) {
            log.warn({ reqId, shopId }, "Shop not found (create product)");
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

        log.info({ reqId, shopId, productId: newProduct._id}, "Product created");

        res.sendStatus(201);
    } catch (e) {
        log.error({ reqId, err: e, shopId: req.params.shopID }, "Product creation failed");

        imageUtil.deleteImage(req.file);

        if (e instanceof TypeError) {
            res.sendStatus(400);
        } else {
            res.sendStatus(500);
        }
    }
});

router.patch("/:shopID/products/:productID", shopOwnerOnly, imageUtil.uploadImage('products').single('image'), async (req, res) => {
    const reqId = req.headers["x-request-id"];

    try {
        const uploadedImage = req.file;
        const { shopID, productID } = req.params;
        const { name, description, origin, points } = req.body;

        log.info({ reqId, shopId: shopID, productId: productID }, "Product update request");
        // L'utilizzo di middleware fa si' che i tipi inferiti da req.params siano union "string | undefined"
        // Per non overcomplicare le cose viene utilizzato !

        // Negozio il cui prodotto e' da aggiornare
        const shop = await Merchant.findOne({ 
            _id: shopID!, 
            products: productID!
        }).exec();

        // Non esiste il negozio 
        if (!shop) {
            log.warn({ reqId, shopId: shopID, productId: productID }, "Shop not found");
            res.sendStatus(404);
            imageUtil.deleteImage(uploadedImage);
            return;
        }

        // Prodotto da aggiornare
        const updatedProduct = await Product.findById(productID).exec();

        // Non esiste il prodotto 
        if (!updatedProduct) {
            log.warn({ reqId, productId: productID }, "Product not found");
            res.sendStatus(404);
            imageUtil.deleteImage(uploadedImage);
            return;
        }

        // Functional Programming Stuff
        const checkField = (field: string, updateCallBack: (s: string) => void) => {
            if (field) {
                field = field.trim();
                if (field == "") {
                    log.warn({ reqId, productId: productID }, "Product update invalid field");
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

                log.debug({ reqId, productId: productID }, "Old product image deleted");
            }
            // Aggiorna il campo immagine
            updatedProduct.image = uploadedImage.filename;
        }

        await updatedProduct.save();

        log.info({ reqId, productId: productID }, "Product updated");
        res.sendStatus(200);

    } catch (e) {
        log.error({ reqId, err: e, productId: req.params.productID }, "Product update failed");

        imageUtil.deleteImage(req.file);

        if (e instanceof TypeError) {
            res.sendStatus(400);
        } else {
            res.sendStatus(500);
        }
    }
});

router.delete("/:shopID/products/:productID", shopOwnerOnly, async (req, res) => {
    const reqId = req.headers["x-request-id"];

    try {
        const shopId = req.params.shopID!;
        const productId = req.params.productID!;

        log.info({ reqId, shopId, productId }, "Product delete request");

        // Negozio il cui prodotto e' da eliminare
        const shop = await Merchant.findOne({ 
            _id: shopId, 
            products: productId 
        }).exec();

        // Non esiste il negozio 
        if (!shop) {
            log.warn({ reqId, shopId }, "Shop not found");
            res.sendStatus(404);
            return;
        }

        // Prodotto da eliminare
        const product = await Product.findById(productId);

        // Non esiste il prodotto
        if (!product) {
            log.warn({ reqId, productId }, "Product not found");
            res.sendStatus(404);
            return;
        }

        // Il prodotto ha un'immagine
        if (product.image) {
            imageUtil.deleteImageFromPath(`products/${product.image}`);

            log.debug({ reqId, productId }, "Product image deleted");
        }
        
        // Eliminazione dalla lista dei prodotti del commericante
        await product.deleteOne().exec();
        await Merchant.updateOne({ 
            _id: shopId,
            products: productId 
        }, { 
            $pull: { 
                products: productId 
            }
        }).exec();

        log.info({ reqId, shopId, productId }, "Product deleted");

        res.sendStatus(200);
    } catch (e) {
        log.error({ reqId, err: e }, "Product delete failed");

        res.sendStatus(500);
    }
});

router.post("/:shopID/prizes", shopOwnerOnly, imageUtil.uploadImage('prizes').single('image'), async (req, res) => {
    const reqId = req.headers["x-request-id"];

    try {
        const uploadedImage = req.file;
        const name: string = req.body.name.trim();
        const description: string = req.body.description.trim();
        const points: number = req.body.points ?? 0;

        const shopId = req.params.shopID;

        log.info({ reqId, shopId, name }, "Prize creation request");

        // Immagine non presente
        if (!uploadedImage) {
            log.warn({ reqId, shopId }, "Prize missing image");

            res.sendStatus(400);
            return;
        }

        // Campi vuoti
        if (name == "" || description == "") {
            log.warn({ reqId, shopId }, "Prize invalid fields");

            res.sendStatus(400);
            imageUtil.deleteImage(uploadedImage);
            return;
        }

        const shop = await Merchant.findById(req.params.shopID).exec();

        if (!shop) {
            log.warn({ reqId, shopId }, "Shop not found (create prize)");
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

        log.info({ reqId, shopId, prizeId: newPrize._id }, "Prize created");

        res.sendStatus(201);
    } catch (e) {
        log.error({ reqId, err: e, shopId: req.params.shopId }, "Prize creation failed");

        imageUtil.deleteImage(req.file);

        if (e instanceof TypeError) {
            res.sendStatus(400);
        } else {
            res.sendStatus(500);
        }
    }
});

router.patch("/:shopID/prizes/:prizeID", shopOwnerOnly, imageUtil.uploadImage('prizes').single('image'), async (req, res) => {
    const reqId = req.headers["x-request-id"];

    try {
        const uploadedImage = req.file;
        const { shopID, prizeID } = req.params;
        const { name, description, points } = req.body;

        log.info({ reqId, shopId: shopID, prizeId: prizeID }, "Prize update request");

        // L'utilizzo di middleware fa si' che i tipi inferiti da req.params siano union "string | undefined"
        // Per non overcomplicare le cose viene utilizzato !

        // Negozio il cui prodotto e' da aggiornare
        const shop = await Merchant.findOne({ 
            _id: shopID!, 
            prizes: prizeID!
        }).exec();

        // Non esiste il negozio 
        if (!shop) {
            log.warn({ reqId, shopId: shopID, prizeId: prizeID }, "Shop not found");
            res.sendStatus(404);
            imageUtil.deleteImage(uploadedImage);
            return;
        }

        // Prodotto da aggiornare
        const updatedPrize = await Prize.findById(prizeID).exec();

        // Non esiste il prodotto 
        if (!updatedPrize) {
            log.warn({ reqId, prizeId: prizeID }, "Prize not found");
            res.sendStatus(404);
            imageUtil.deleteImage(uploadedImage);
            return;
        }

        // Functional Programming Stuff
        const checkField = (field: string, updateCallBack: (s: string) => void) => {
            if (field) {
                field = field.trim();
                if (field == "") {
                    log.warn({ reqId, prizeId: prizeID }, "Prize update invalid field");
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

                log.debug({ reqId, prizeId: prizeID }, "Old prize image deleted");
            }
            // Aggiorna il campo immagine
            updatedPrize.image = uploadedImage.filename;
        }

        await updatedPrize.save();

        log.info({ reqId, prizeId: prizeID }, "Prize updated");

        res.sendStatus(200);
    } catch (e) {
        log.error({ reqId, err: e, prizeId: req.params.prizeID}, "Prize update failed");

        imageUtil.deleteImage(req.file);

        if (e instanceof TypeError) {
            res.sendStatus(400);
        } else {
            res.sendStatus(500);
        }
    }
});

router.delete("/:shopID/prizes/:prizeID", shopOwnerOnly, async (req, res) => {
    const reqId = req.headers["x-request-id"];

    try {
        const shopID  = req.params.shopID!;
        const prizeID = req.params.prizeID!;

        log.info({ reqId, shopId: shopID, prizeId: prizeID }, "Prize delete request");

        // Negozio il cui prodotto e' da eliminare
        const shop = await Merchant.findOne({ 
            _id: shopID, 
            prizes: prizeID 
        }).exec();

        // Non esiste il negozio 
        if (!shop) {
            log.warn({ reqId, shopId: shopID }, "Shop not found");
            res.sendStatus(404);
            return;
        }

        // Prodotto da eliminare
        const prize = await Prize.findById(prizeID);

        // Non esiste il prodotto
        if (!prize) {
            log.warn({ reqId, prizeId: prizeID }, "Prize not found");
            res.sendStatus(404);
            return;
        }

        // Il prodotto ha un'immagine
        if (prize.image) {
            imageUtil.deleteImageFromPath(`prizes/${prize.image}`);

            log.debug({ reqId, prizeId: prizeID }, "Prize image deleted");
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

        log.info({ reqId, shopId: shopID, prizeId: prizeID }, "Prize deleted");

        res.sendStatus(200);
    } catch (e) {
        log.info({ reqId, err: e, shopId: req.params.shopID, prizeId: req.params.prizeID }, "Prize delete failed");

        res.sendStatus(500);
    }
});

export default router;