import mongoose, { Schema } from "mongoose";

export default mongoose.model("Client", new Schema({
    username: String,
    email: String,
    password: String,
    points: {
        type: Map,
        of: Number
    }
}), "Clients");