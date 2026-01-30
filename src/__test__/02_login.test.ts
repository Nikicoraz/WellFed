import app from '../app.js';
import request from 'supertest';

beforeEach(async () => {
    // Precondizione TC 2.0
    await request(app).post('/api/v1/register/client').send({
        username: 'cliente',
        email: 'cliente@Ltest.com',
        password: 'Sicura!123#'
    });
    // Precondizione TC 2.1
    await request(app)
        .post('/api/v1/register/merchant')
        .field('name', 'Negozio')
        .field('email', 'commerciante@Ltest.com')
        .field('password', 'Sicura!123#')
        .field('address', 'Via Test')
        .field('partitaIVA', 'IT12345678901')
        .attach('image', Buffer.from('img'), 'shop.jpg');
});

describe('Login Controller', () => {
    it('2.0 Accesso di un cliente con credenziali valide', async () => {
        const res = await request(app).post('/api/v1/login').send({
            email: 'cliente@Ltest.com',
            password: 'Sicura!123#',
            SSO: false
        });
        
        expect(res.status).toBe(200);
        expect(res.body.token).toBeDefined();
        expect(res.headers.location).toBe('/');
    });

    it('2.1 Accesso di un commerciante con credenziali valide', async () => {
        const res = await request(app).post('/api/v1/login').send({
            email: 'commerciante@Ltest.com',
            password: 'Sicura!123#'
        });

        expect(res.status).toBe(200);
        expect(res.headers.location).toMatch(/\/shop\//);
    });

    it('2.2 Tentativo di accesso con credenziali non corrispondenti', async () => {
        const res = await request(app).post('/api/v1/login').send({
            email: 'cliente@Ltest.com',
            password: 'sicur1!23#'
        });

        expect(res.status).toBe(401);
    });
});
