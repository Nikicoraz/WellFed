import mongoose, { Schema } from "mongoose";

export default mongoose.model("Merchant", new Schema({
    name: String,
    partitaIVA: String,
    address: String,
    email: String,
    password: String
}), "Merchants");