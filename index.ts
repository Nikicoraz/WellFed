import "dotenv/config";
import app from './src/app.js';
import mongoose from 'mongoose';


const PORT = process.env.PORT || 3000;
const connectOptions: mongoose.ConnectOptions = process.env.ADMIN == "true" ? { authSource: "admin", dbName: "WellFed" } : { dbName: "WellFed" };
const connectionString = process.env.ATLAS_CONNECTION == "true" ? `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_URL}` : `mongodb://${process.env.DB_USER!}:${process.env.DB_PASSWORD!}@${process.env.DB_URL!}:27017`;

app.locals.db = mongoose.connect(connectionString, connectOptions).then(() => {
    app.listen(PORT, () => {
        console.log(`Server listening on http://localhost:${PORT}`);
    });
});