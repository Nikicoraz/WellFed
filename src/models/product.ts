import mongoose, { Schema } from "mongoose";

export default mongoose.model("Product", new Schema({
    name: String,
    description: String,
    origin: String,
    image: String,
    points: Number,
    shopID: { type: Schema.Types.ObjectId, ref: "Merchant", index: true }
}).index({
    name: 'text'
}), "Products");