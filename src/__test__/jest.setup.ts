import 'dotenv/config';
import mongoose from 'mongoose';

beforeAll(async () => {
    // Nuovo database con dati per il testing per evitare il reset dei vostri dati
    const dbName = process.env.NODE_ENV === 'test' ? 'WellFed_test' : (() => {
        throw new Error('NODE_ENV must be "test" when running Jest'); 
    })();

    const connectOptions: mongoose.ConnectOptions = process.env.ADMIN === "true" ? { authSource: "admin", dbName } : { dbName };
    const connectionString = process.env.ATLAS_CONNECTION === "true" ? `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_URL}` : `mongodb://${process.env.DB_USER!}:${process.env.DB_PASSWORD!}@${process.env.DB_URL!}:27017`;

    await mongoose.connect(connectionString, connectOptions);
});

beforeEach(async () => {
    if (!mongoose.connection.db) {
        throw new Error('Database not initialized');
    }

    // TEST DB RESET
    await mongoose.connection.db.dropDatabase();
});

afterAll(async () => {
    await mongoose.disconnect();
});