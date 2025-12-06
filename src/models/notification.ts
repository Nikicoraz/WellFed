import mongoose, { Schema } from "mongoose";

export default mongoose.model("Notification", new Schema({
    shopLink: String,
    title: String,
    notificationMessage: String
}), "Notifications");