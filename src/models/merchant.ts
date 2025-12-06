import mongoose, { Schema } from "mongoose";

export default mongoose.model("Merchant", new Schema({
    name: String,
    partitaIVA: String,
    address: String,
    email: String,
    password: String,
    image: String,
    products: [ 
        {
            type: Schema.Types.ObjectId,
            ref: "Product",
        } 
    ],
    prizes: [
        {
            type: Schema.Types.ObjectId,
            ref: "Prize",
        } 
    ]
}).index({
    name: "text"
}), "Merchants");