import mongoose, { Schema } from "mongoose";

export default mongoose.model("Notification", new Schema({
    shopLink: String,
    viewed: Boolean,
    notificationMessage: String
}), "Notifications");