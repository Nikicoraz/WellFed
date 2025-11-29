import mongoose, { Schema } from "mongoose";

export enum TransactionType{
    PointAssignment = "Point Assignment",
    PrizeRedeem = "Prize Redeem"
}

export enum TransactionStatus{
    Success="Success",
    Failure="Failure"
}

export const TransactionItems = new Schema({
    products: [{ type: Schema.Types.ObjectId, ref: "Product" }],
    prizes: [{ type: Schema.Types.ObjectId, ref: "Prize" }]
}, { _id: false });

export default mongoose.model("Transaction", new Schema({
    issuerID: Schema.Types.ObjectId,
    receiverID: Schema.Types.ObjectId,
    points: Number,
    transactionType: {
        type: String,
        enum: Object.values(TransactionType)
    },
    transactionStatus: {
        type: String,
        enum: Object.values(TransactionStatus)
    },
    items: TransactionItems
}));