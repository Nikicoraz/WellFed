import app from '../app.js';
import request from 'supertest';


beforeEach(async () => {
    // Precondizione TC 1.1
    await request(app)
        .post('/api/v1/register/client')
        .send({
            username: 'esistente',
            email: 'esistente@Rtest.com',
            password: 'Sicura!123#'
        });
});

describe('Registration Controller', () => {
    it('1.0 Registrazione di un nuovo cliente in modo corretto', async () => {
        const response = await request(app)
            .post('/api/v1/register/client')
            .send({
                username: 'new.user',
                email: 'nuova@Rtest.com',
                password: 'Sicura!123#'
            });
        expect(response.status).toBe(201);
    });

    it('1.1 Tentativo di registrazione con email già esistente', async () => {
        const response = await request(app)
            .post('/api/v1/register/client')
            .send({
                username: 'other.user',
                email: 'esistente@Rtest.com',
                password: 'Sicura!123#'
            });
        expect(response.status).toBe(409);
    });

    it('1.2 Tentativo di registrazione con password che viola le politiche di sicurezza', async () => {
        const response = await request(app)
            .post('/api/v1/register/client')
            .send({
                username: 'weak.user',
                email: 'nuova2@Rtest.com',
                password: 'debole'
            });
        expect(response.status).toBe(400);
    });

    it('1.3 Tentativo di registrazione con campo email vuoto', async () => {
        const response = await request(app)
            .post('/api/v1/register/client')
            .send({
                username: 'no.user',
                email: '',
                password: 'Sicura!123#'
            });
        expect(response.status).toBe(400);
    });

    it('1.4 Tentativo di registrazione con campo email errato', async () => {
        const response = await request(app)
            .post('/api/v1/register/client')
            .send({
                username: 'no2.user',
                email: 'nuova3Rtest.com',
                password: 'Sicura!123#'
            });
        expect(response.status).toBe(400);
    });
});
