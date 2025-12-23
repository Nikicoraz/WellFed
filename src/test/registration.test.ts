import app from '../app.js';
import request from 'supertest';

describe('Registration Controller', () => {
    it('1.0 POST /register/client creates a new client', async () => {
        const response = await request(app)
            .post('/api/v1/register/client')
            .send({
                username: 'new.user',
                email: 'nuova@test.com',
                password: 'Sicura!123#'
            });
        expect(response.status).toBe(201);
    });

    it('1.1 POST /register/client with existing email returns 409', async () => {
        const response = await request(app)
            .post('/api/v1/register/client')
            .send({
                username: 'other.user',
                email: 'esistente@test.com',
                password: 'Sicura!123#'
            });
        expect(response.status).toBe(409);
    });

    it('1.2 POST /register/client with weak password returns 400', async () => {
        const response = await request(app)
            .post('/api/v1/register/client')
            .send({
                username: 'weak.user',
                email: 'nuova2@test.com',
                password: 'debole'
            });
        expect(response.status).toBe(400);
    });

    it('1.3 POST /register/client with empty email returns 400', async () => {
        const response = await request(app)
            .post('/api/v1/register/client')
            .send({
                username: 'nouser',
                email: '',
                password: 'Sicura!123#'
            });
        expect(response.status).toBe(400);
    });
});
