import mongoose, { Schema } from "mongoose";

export default mongoose.model("Client", new Schema({
    username: String,
    email: String,
    password: String,
    points: {
        type: Map,
        of: Number
    },
    notifications: [{
        notification: {
            type: Schema.Types.ObjectId,
            ref: "Notification",
            required: true
        },
        viewed: {
            type: Boolean,
            default: false
        }
    }]
}), "Clients");