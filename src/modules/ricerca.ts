import Merchant from "../models/merchant.js";
import ProductModel from "../models/product.js";
import type { Types } from "mongoose";
import express from "express";

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
    points: number
};

const emptyResult = {
    shops: [] as Shop[],
    products: [] as Product[]
};

// TODO: Mappa oggetti a interfaccia
router.get("/", async(req, res) => {
    try {
        const query = req.query.query;
        const filter: SearchFilter | undefined  = req.query.filter as SearchFilter;
        if (!query) {
            res.json(emptyResult);
            return;
        }

        // Nel caso le query siano troppo lente, si può usare meglio l'indice
        // impostando l'inizio della ricerca con '^'
        const searchQuery = new RegExp(`${query}` as string, "i");

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
                    image: e.image!,
                    points: e.points!
                };
            });
        }

        if (!filter || filter == SearchFilter.Shop) {
            ret.shops = (await Merchant.find({
                name: { $regex: searchQuery }
            })).map(e => {
                return {
                    id: e._id,
                    name: e.name!,
                    address: e.address!,
                    image: e.image!
                };
            });
        }

        res.json(ret);
    } catch (e) {
        console.error(e);
        res.sendStatus(500);
    }
});

export default router;