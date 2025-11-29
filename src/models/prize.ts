import mongoose, { Schema } from "mongoose";

export default mongoose.model("Prize", new Schema({
    name: String,
    description: String,
    image: String,
    points: Number
}), "Prizes");