import app from '../app.js';
import request from 'supertest';

describe('User Controller', () => {
    it('GET /shops should return a list of shops', async () => {
        const response = await request(app).get('/api/v1/shops');
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
    });
});

