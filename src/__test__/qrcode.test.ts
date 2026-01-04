import app from '../app.js';
import request from 'supertest';

//Jest ha problemi con i timer, per far passare la test suite eseguire 
// npm test -- --detectOpenHandles
// finché non trovo una soluzione

let merchantToken: string;
let clientToken: string;
let fakeProductId: string;

beforeEach(async () => {
    await request(app)
        .post('/api/v1/register/merchant')
        .field('name', 'Shop')
        .field('email', 'shop@test.com')
        .field('password', 'Sicura!123#')
        .field('address', 'Via Test')
        .field('partitaIVA', 'IT12345678901')
        .attach('image', Buffer.from('img'), 'shop.jpg');

    const merchantLogin = await request(app)
        .post('/api/v1/login')
        .send({
            email: 'shop@test.com',
            password: 'Sicura!123#'
        });

    merchantToken = merchantLogin.body.token;

    await request(app)
        .post('/api/v1/register/client')
        .send({
            username: 'client',
            email: 'client@test.com',
            password: 'Sicura!123#'
        });

    const clientLogin = await request(app)
        .post('/api/v1/login')
        .send({
            email: 'client@test.com',
            password: 'Sicura!123#'
        });

    clientToken = clientLogin.body.token;

    fakeProductId = '507f1f77bcf86cd799439011';
});

describe('QR Code Controller', () => {

    it('3.0 Generazione codice QR con lista prodotti valida', async () => {
        const res = await request(app)
            .post('/api/v1/QRCodes/assignPoints')
            .set('Authorization', `Bearer ${merchantToken}`)
            .send([
                { productID: fakeProductId, quantity: 2 }
            ]);

        expect(res.status).toBe(200);
        expect(typeof res.text).toBe('string');
        expect(res.text).toMatch(/^data:image\/png;base64,/);
    });

    it('3.1 Tentativo di generazione QR con lista prodotti non valida (cliente)', async () => {
        const res = await request(app)
            .post('/api/v1/QRCodes/assignPoints')
            .set('Authorization', `Bearer ${clientToken}`)
            .send([
                { productID: fakeProductId, quantity: 1 }
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

    it('3.3 Generazione QR con prodotto inesistente', async () => {
        const res = await request(app)
            .post('/api/v1/QRCodes/assignPoints')
            .set('Authorization', `Bearer ${merchantToken}`)
            .send([
                { productID: fakeProductId, quantity: 5 }
            ]);

        expect(res.status).toBe(200);
        expect(res.text).toMatch(/^data:image\/png;base64,/);
    });

    it('3.4 Generazione QR senza token', async () => {
        const res = await request(app)
            .post('/api/v1/QRCodes/assignPoints')
            .send([
                { productID: fakeProductId, quantity: 1 }
            ]);

        expect(res.status).toBe(401);
    });

});
