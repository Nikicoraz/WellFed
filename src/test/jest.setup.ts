import 'dotenv/config';
import Client from '../models/client.js';
import Merchant from '../models/merchant.js';
import Prize from '../models/prize.js';
import Product from '../models/product.js';
import argon from 'argon2';
import mongoose from 'mongoose';

beforeAll(async () => {
    // Nuovo database con dati per il testing per evitare il reset dei vostri dati
    const dbName = process.env.NODE_ENV === 'test' ? 'WellFed_test' : 'WellFed';

    const connectOptions: mongoose.ConnectOptions =process.env.ADMIN === "true" ? { authSource: "admin", dbName } : { dbName };
    const connectionString = process.env.ATLAS_CONNECTION === "true" ? `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_URL}` : `mongodb://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_URL}:27017`;

    await mongoose.connect(connectionString, connectOptions);
});

beforeEach(async () => {
    if (!mongoose.connection.db)
        throw new Error('Database not initialized');

    await mongoose.connection.db.dropDatabase(); // HARD RESET
    const hashedPassword = await argon.hash('Sicura!123#'); // Usata spesso

    // Precondizione test 1.1
    await Client.create({
        username: 'esistente',
        email: 'esistente@test.com',
        password: hashedPassword,
        SSO: false,
        points: {}
    });

    // Precondizione test 2.0, 2.2
    await Client.create({
        username: 'cliente',
        email: 'cliente@valida.com',
        password: hashedPassword,
        SSO: false,
        points: {}
    });

    // Precondizione test 2.1, 3.0, 4.0
    const merchant = await Merchant.create({
        name: 'Negozio Test',
        email: 'commerciante@valido.com',
        password: hashedPassword,
        address: 'Via Test 1',
        partitaIVA: 'IT12345678901',
        image: 'shop.jpg',
        products: [],
        prizes: []
    });

    // Precondizione test 3.0
    const product = await Product.create({
        name: 'Prodotto Test',
        description: 'Descrizione',
        origin: 'Italia',
        image: 'product.jpg',
        points: 10
    });

    merchant.products.push(product._id);
    await merchant.save();

    //tmp
    const prize = await Prize.create({
        name: 'Premio Test',
        description: 'Premio',
        image: 'prize.jpg',
        points: 20
    });

    merchant.prizes.push(prize._id);
    await merchant.save();
});

afterAll(async () => {
    await mongoose.disconnect();
});