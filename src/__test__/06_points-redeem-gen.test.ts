import app from '../app.js';
import { clearAllPendingTimers } from '../modules/qrcode.js';
import request from 'supertest';

let merchantToken: string;
let clientToken: string;
let productID: string;

beforeAll(async () => {
    // Registrazione commerciante
    let res = await request(app)
        .post('/api/v1/register/merchant')
        .field('name', 'Shop')
        .field('email', 'shop@test.com')
        .field('password', 'Sicura!123#')
        .field('address', 'Via Test')
        .field('partitaIVA', 'IT12345678901')
        .attach('image', Buffer.from('img'), 'shop.jpg');
    expect(res.status).toBe(202);
    
    // Login commerciante
    res = await request(app)
        .post('/api/v1/login')
        .send({
            email: 'shop@test.com',
            password: 'Sicura!123#'
        });
    expect(res.status).toBe(200);

    merchantToken = res.body.token;
    const shopID = res.header.location!.split("/shop/")[1];

    // Aggiungo un prodotto
    res = await request(app)
        .post(`/api/v1/shops/${shopID}/products`)
        .set("Authorization", `Bearer ${merchantToken}`)
        .field("name", "Mela")
        .field("description", "Mela rossa bio")
        .field("origin", "Italia")
        .field("points", 10)
        .attach("image", Buffer.from("img"), "mela.jpg");
    expect(res.status).toBe(201);

    res = await request(app)
        .get(`/api/v1/shops/${shopID}/products`)
        .set("Authorization", `Bearer ${merchantToken}`);
    expect(res.status).toBe(200);

    productID = res.body[0].id;

    // Registrazione cliente
    res = await request(app)
        .post('/api/v1/register/client')
        .send({
            username: 'Cliente',
            email: 'cliente@test.com',
            password: 'Sicura!123#'
        });
    expect(res.status).toBe(201);

    // Login cliente
    res = await request(app)
        .post('/api/v1/login')
        .send({
            email: 'cliente@test.com',
            password: 'Sicura!123#'
        });
    expect(res.status).toBe(200);

    clientToken = res.body.token;
});

afterAll(async () => {
    await clearAllPendingTimers();
});

describe('Redeem points QR generation Controller', () => {
    it('6.0 Generazione codice QR (per la riscossione di punti) da lista prodotti valida', async () => {
        const res = await request(app)
            .post('/api/v1/QRCodes/assignPoints')
            .set('Authorization', `Bearer ${merchantToken}`)
            .send([
                { productID, quantity: 2 }
            ]);
        expect(res.status).toBe(200);
        expect(typeof res.text).toBe('string');
        expect(res.text).toMatch(/^data:image\/png;base64,/);
    });

    it('6.1 Tentativo di generazione codice QR con lista prodotti valida ma token di autenticazione di un cliente invece che di un commerciante', async () => {
        const res = await request(app)
            .post('/api/v1/QRCodes/assignPoints')
            .set('Authorization', `Bearer ${clientToken}`)
            .send([
                { productID, quantity: 1 }
            ]);
        expect(res.status).toBe(400);
    });

    it('6.2 Generazione codice QR con lista prodotti vuota', async () => {
        const res = await request(app)
            .post('/api/v1/QRCodes/assignPoints')
            .set('Authorization', `Bearer ${merchantToken}`)
            .send([]);
        expect(res.status).toBe(200);
        expect(res.text).toMatch(/^data:image\/png;base64,/);
    });

    it('6.3 Tentativo di generazione codice QR senza token', async () => {
        const res = await request(app)
            .post('/api/v1/QRCodes/assignPoints')
            .send([
                { productID, quantity: 1 }
            ]);
        expect(res.status).toBe(401);
    });
});
