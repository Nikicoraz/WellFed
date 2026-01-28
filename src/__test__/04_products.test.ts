import app from "../app.js";
import request from "supertest";

let merchantToken: string;
let shopID: string;

beforeAll(async () => {
    await request(app)
        .post("/api/v1/register/merchant")
        .field("name", "Negozio Test")
        .field("email", "shop@test.com")
        .field("password", "Sicura!123#")
        .field("address", "Via Test")
        .field("partitaIVA", "IT12345678901")
        .attach("image", Buffer.from("img"), "shop.jpg");
 
    // Accesso merchant per estrarre il token
    const login = await request(app)
        .post("/api/v1/login")
        .send({ email: "shop@test.com", password: "Sicura!123#" });

    merchantToken = login.body.token;
    const location = login.headers.location;
    if (!location) throw new Error("Location header missing");
    const parts = location.split("/shop/");
    if (parts.length < 2 || !parts[1]) throw new Error("Shop ID not found in location");
    shopID = parts[1];

    await request(app).post('/api/v1/register/client').send({
        username: 'cliente',
        email: 'cliente@test.com',
        password: 'Sicura!123#'
    });
    
});

describe("Product Management", () => {

    it("4.0 Add new product - valid data", async () => {
        const res = await request(app)
            .post(`/api/v1/shops/${shopID}/products`)
            .set("Authorization", `Bearer ${merchantToken}`)
            .field("name", "Mela")
            .field("description", "Mela rossa bio")
            .field("origin", "Italia")
            .field("points", 10)
            .attach("image", Buffer.from("img"), "mela.jpg");

        expect(res.status).toBe(201);
    });

    it("4.1 Add product with missing fields", async () => {
        const res = await request(app)
            .post(`/api/v1/shops/${shopID}/products`)
            .set("Authorization", `Bearer ${merchantToken}`)
            .field("name", "")
            .field("description", "desc")
            .field("origin", "Italia")
            .field("points", 10)
            .attach("image", Buffer.from("img"), "mela.jpg");

        expect(res.status).toBe(400);
    });

    it("4.2 Add product without image", async () => {
        const res = await request(app)
            .post(`/api/v1/shops/${shopID}/products`)
            .set("Authorization", `Bearer ${merchantToken}`)
            .field("name", "Pera")
            .field("description", "desc")
            .field("origin", "Italia")
            .field("points", 5);

        expect(res.status).toBe(400);
    });

    it("4.3 Add product as client", async () => {
        const clientLogin = await request(app)
            .post('/api/v1/login')
            .send({
                email: 'cliente@test.com',
                password: 'Sicura!123#'
            });

        console.log(clientLogin.body.token);
        
        const res = await request(app)
            .post(`/api/v1/shops/${shopID}/products`)
            .set("Authorization", `Bearer ${clientLogin.body.token}`)
            .field("name", "Test")
            .field("description", "desc")
            .field("origin", "Italia")
            .field("points", 10)
            .attach("image", Buffer.from("img"), "test.jpg");

        expect(res.status).toBe(401);
    });

    it("4.4 Add product with invalid shopID", async () => {
        const res = await request(app)
            .post(`/api/v1/shops/123456789012345678901234/products`)
            .set("Authorization", `Bearer ${merchantToken}`)
            .field("name", "Mela")
            .field("description", "desc")
            .field("origin", "Italia")
            .field("points", 10)
            .attach("image", Buffer.from("img"), "mela.jpg");

        expect(res.status).toBe(404);
    });

});
