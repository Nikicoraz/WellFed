import "dotenv/config";
import app from './src/app.js';
import mongoose from 'mongoose';


const PORT = process.env.PORT || 3000;
const connectOptions = process.env.ADMIN == "true" ? {authSource: "admin"} : {};

app.locals.db = mongoose.connect(`mongodb://${process.env.DB_USER!}:${process.env.DB_PASSWORD!}@${process.env.DB_URL!}:27017/WellFed`, connectOptions).then(() => {
    
    app.listen(PORT, () => {
        console.log(`Server listening on http://localhost:${PORT}`);
    });
});