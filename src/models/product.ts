import mongoose, { Schema } from "mongoose";

export default mongoose.model("Product", new Schema({
    name: String,
    description: String,
    origin: String,
    image: String,
    points: Number
}).index({
    name: 'text'
}), "Products");