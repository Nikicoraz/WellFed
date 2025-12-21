import 'dotenv/config';
import mongoose from 'mongoose';

beforeAll(async () => {
    const connectOptions: mongoose.ConnectOptions = process.env.ADMIN == "true" ? { authSource: "admin", dbName: "WellFed" } : { dbName: "WellFed" };
    const connectionString = process.env.ATLAS_CONNECTION == "true" ? `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_URL}` : `mongodb://${process.env.DB_USER!}:${process.env.DB_PASSWORD!}@${process.env.DB_URL!}:27017`;

    await mongoose.connect(connectionString, connectOptions);
});

afterAll(async () => {
    await mongoose.disconnect();
});