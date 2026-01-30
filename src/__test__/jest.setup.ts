import 'dotenv/config';
import mongoose from 'mongoose';

beforeAll(async () => {
    const workerId = process.env.JEST_WORKER_ID || '0';
    console.log(workerId);
    const dbName = `WellFed_test_${workerId}`;          // Different db for each test Suite

    const connectOptions: mongoose.ConnectOptions = process.env.ADMIN === "true" ? { authSource: "admin", dbName } : { dbName };
    const connectionString = process.env.ATLAS_CONNECTION === "true" ? `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_URL}` : `mongodb://${process.env.DB_USER!}:${process.env.DB_PASSWORD!}@${process.env.DB_URL!}:27017`;

    await mongoose.connect(connectionString, connectOptions);

    if (!mongoose.connection.db) {
        throw new Error('Database not initialized');
    }

    // TEST DB RESET
    await mongoose.connection.db.dropDatabase();
});

afterAll(async () => {
    await mongoose.disconnect();
});