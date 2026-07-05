import Merchant from "../models/merchant.js";
import ProductModel from "../models/product.js";
import type { Types } from "mongoose";
import express from "express";
import { logger } from "./logger.js";

const router = express.Router();

enum SearchFilter{
    Product="products",
    Shop="shops"
};


interface Shop {
    id: Types.ObjectId,
    name: string,
    address: string,
    image: string
};

interface Product {
    id: Types.ObjectId,
    name: string,
    description: string,
    origin: string,
    image: string,
    points: number,
    shopID: Types.ObjectId
};

const emptyResult = {
    shops: [] as Shop[],
    products: [] as Product[]
};

router.get("/", async(req, res) => {
    const reqId = req.headers["x-request-id"];

    
    try {
        const query = req.query.query;
        const filter: SearchFilter | undefined  = req.query.filter as SearchFilter;
        if (!query) {
            logger.debug({ reqId }, "Search request with empty query");
            res.json(emptyResult);
            return;
        }

        // Nel caso le query siano troppo lente, si può usare meglio l'indice
        // impostando l'inizio della ricerca con '^', però si perdono i risultati parziali
        const searchQuery = new RegExp(`${query}` as string, "i");

        logger.info({ reqId, query, filter }, "Search request started");

        // Spread operator per creare una copia
        const ret = {...emptyResult};

        if (!filter || filter == SearchFilter.Product) {
            ret.products = (await ProductModel.find({
                name: { $regex: searchQuery }
            })).map(e => {
                return {
                    id: e._id,
                    name: e.name!,
                    description: e.description!,
                    origin: e.origin!,
                    image: "/public/images/products/" + e.image!,
                    points: e.points!,
                    shopID: e.shopID!
                };
            });

            logger.debug({ reqId, query, results: ret.products.length }, "Product search complete");
        }

        if (!filter || filter == SearchFilter.Shop) {
            ret.shops = (await Merchant.find({
                name: { $regex: searchQuery }
            })).map(e => {
                return {
                    id: e._id,
                    name: e.name!,
                    address: e.address!,
                    image: "/public/images/merchants/" + e.image!
                };
            });

            logger.debug({ reqId, query, results: ret.shops.length }, "Shops search complete");
        }

        logger.info({ reqId, query, products: ret.products.length, shops: ret.shops.length}, "Search completed");

        res.json(ret);
    } catch (e) {
        logger.error({ reqId, err: e }, "Search request failed");
        res.sendStatus(500);
    }
});

export default router;