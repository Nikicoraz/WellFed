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
 
    const login = await request(app)
        .post("/api/v1/login")
        .send({ email: "shop@test.com", password: "Sicura!123#" });

    merchantToken = login.body.token;
    const location = login.headers.location;
    
    shopID = login.body.shopID;
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
    it("4.0 Aggiunta di un nuovo prodotto con dati completi", async () => { // Spero funzioni dopo il pull del fix shopID
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

    it("4.1 Aggiunta di un prodotto con uno o più campi vuoti", async () => {
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

    it("4.2 Aggiunta prodotto senza immagine", async () => {
        const res = await request(app)
            .post(`/api/v1/shops/${shopID}/products`)
            .set("Authorization", `Bearer ${merchantToken}`)
            .field("name", "Pera")
            .field("description", "desc")
            .field("origin", "Italia")
            .field("points", 5);

        expect(res.status).toBe(400);
    });

    it("4.3 entativo di aggiunta prodotto da parte di un cliente (Atuenticato)", async () => { // Spero funzioni dopo il pull del fix shopID
        const clientLogin = await request(app)
            .post('/api/v1/login')
            .send({
                email: 'cliente@test.com',
                password: 'Sicura!123#',
                SSO: false
            });

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

    it("4.4 Aggiunta prodotto con shopID inesistente", async () => {
        const res = await request(app)
            .post(`/api/v1/shops/123456789012345678901234/products`)
            .set("Authorization", `Bearer ${merchantToken}`)
            .field("name", "Mela")
            .field("description", "desc")
            .field("origin", "Italia")
            .field("points", 10)
            .attach("image", Buffer.from("img"), "mela.jpg");

        expect(res.status).toBe(401);
    });
});