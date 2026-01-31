import app from '../app.js';
import { clearAllPendingTimers } from '../modules/qrcode.js';
import request from 'supertest';

// Usato nei TC 3.0, 3.1, 3.2 e 3.3
let merchantToken: string;
// Usato nei TC 3.0, 3.1, 3.3
let clientToken: string;
// Usato nel TC 3.2
let productID: string;

beforeAll(async () => {
    // Registrazione e login commerciante per ricavare merchantToken valido per la generazione di codici QR
    await request(app)
        .post('/api/v1/register/merchant')
        .field('name', 'Shop')
        .field('email', 'shop@test.com')
        .field('password', 'Sicura!123#')
        .field('address', 'Via Test')
        .field('partitaIVA', 'IT12345678901')
        .attach('image', Buffer.from('img'), 'shop.jpg');

    const mLogin = await request(app)
        .post('/api/v1/login')
        .send({
            email: 'shop@test.com',
            password: 'Sicura!123#'
        });
    merchantToken = mLogin.body.token;
    const location = mLogin.headers.location!;

    const parts = location.split("/shop/");
    const shopID = parts[1];

    // Aggiungo un prodotto
    const res = await request(app)
        .post(`/api/v1/shops/${shopID}/products`)
        .set("Authorization", `Bearer ${merchantToken}`)
        .field("name", "Mela")
        .field("description", "Mela rossa bio")
        .field("origin", "Italia")
        .field("points", 10)
        .attach("image", Buffer.from("img"), "mela.jpg");
    expect(res.status).toBe(201);

    const shopProducts = await request(app)
        .get(`/api/v1/shops/${shopID}/products`)
        .set("Authorization", `Bearer ${merchantToken}`);
    productID = shopProducts.body[0].id;
    console.log(productID);

    // Registrazione e login cliente per ricavare clientToken valido
    await request(app)
        .post('/api/v1/register/client')
        .send({
            username: 'Cliente',
            email: 'cliente@test.com',
            password: 'Sicura!123#'
        });

    const clientLogin = await request(app)
        .post('/api/v1/login')
        .send({
            email: 'cliente@test.com',
            password: 'Sicura!123#'
        });
    clientToken = clientLogin.body.token;
});

afterAll(async () => {
    await clearAllPendingTimers();
});

describe('QR Code Controller', () => {
    it('3.0 Generazione codice QR (per la riscossione di punti) da lista prodotti valida', async () => {
        const res = await request(app)
            .post('/api/v1/QRCodes/assignPoints')
            .set('Authorization', `Bearer ${merchantToken}`)
            .send([
                { productID: productID, quantity: 2 }
            ]);

        expect(res.status).toBe(200);
        expect(typeof res.text).toBe('string');
        expect(res.text).toMatch(/^data:image\/png;base64,/);
    });

    it('3.1 Tentativo di generazione QR con lista prodotti valida ma token di autenticazione di un cliente invece che di un commerciante', async () => {
        const res = await request(app)
            .post('/api/v1/QRCodes/assignPoints')
            .set('Authorization', `Bearer ${clientToken}`)
            .send([
                { productID: productID, quantity: 1 }
            ]);

        expect(res.status).toBe(400);
    });

    it('3.2 Generazione QR con lista prodotti vuota', async () => {
        const res = await request(app)
            .post('/api/v1/QRCodes/assignPoints')
            .set('Authorization', `Bearer ${merchantToken}`)
            .send([]);

        expect(res.status).toBe(200);
        expect(res.text).toMatch(/^data:image\/png;base64,/);
    });

    it('3.3 Generazione QR senza token', async () => {
        const res = await request(app)
            .post('/api/v1/QRCodes/assignPoints')
            .send([
                { productID: productID, quantity: 1 }
            ]);

        expect(res.status).toBe(401);
    });
});
