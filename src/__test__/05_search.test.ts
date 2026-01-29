import app from "../app.js";
import request from "supertest";

let merchantToken: string;
let shopID: string;

beforeAll(async () => {
    // Registrazione e login per ricavare shopID e merchantToken validi per l'inserimento di prodotti
    await request(app)
        .post("/api/v1/register/merchant")
        .field("name", "Negozio Test")
        .field("email", "shop@test.com")
        .field("password", "Sicura!123#")
        .field("address", "Via Test")
        .field("partitaIVA", "IT12345678901")
        .attach("image", Buffer.from("img"), "shop.jpg");

    const mLogin = await request(app)
        .post("/api/v1/login")
        .send({ email: "shop@test.com", password: "Sicura!123#" });

    merchantToken = mLogin.body.token;
    const location = mLogin.headers.location;
    
    shopID = mLogin.body.shopID;
    if (!location) throw new Error("Location header missing");
    const parts = location.split("/shop/");
    if (parts.length < 2 || !parts[1]) throw new Error("Shop ID not found in location");
    shopID = parts[1];

    // Inserimento di prodotti con il mercante creato sopra
    await request(app)
        .post(`/api/v1/shops/${shopID}/products`)
        .set("Authorization", `Bearer ${merchantToken}`)
        .field("name", "Ciliegia Bio")
        .field("description", "Ciliegie fresche")
        .field("origin", "Italia")
        .field("points", 10)
        .attach("image", Buffer.from("img"), "ciliegia.jpg");

    await request(app)
        .post(`/api/v1/shops/${shopID}/products`)
        .set("Authorization", `Bearer ${merchantToken}`)
        .field("name", "Mela Verde")
        .field("description", "Mela")
        .field("origin", "Italia")
        .field("points", 5)
        .attach("image", Buffer.from("img"), "mela.jpg");

    // Nuovo mercante con nome ambiguo per testare i filtri
    await request(app)
        .post("/api/v1/register/merchant")
        .field("name", "Ciliegia's shop")
        .field("email", "shop2@test.com")
        .field("password", "Sicura!123#")
        .field("address", "Via Test")
        .field("partitaIVA", "IT12345678901")
        .attach("image", Buffer.from("img"), "shop.jpg");

});

describe("Search API", () => {
    it("5.0 Ricerca prodotti per nome con filtro attivo", async () => {
        const res = await request(app)
            .get("/api/v1/search")
            .query({ query: "Ciliegia", filter: "products" });
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.products)).toBe(true);
        expect(res.body.products.length).toBeGreaterThan(0);    // deve ritornare il prodotto registrato sopra (filter: "shops")
        expect(res.body.shops.length).toBe(0);                  // non deve ritornare negozi (filter: "products")
    });

    it("5.1 Ricerca negozi per nome con filtro shops", async () => {
        const res = await request(app)
            .get("/api/v1/search")
            .query({ query: "negozio", filter: "shops" });

        expect(res.status).toBe(200);
        expect(res.body.shops.length).toBeGreaterThan(0);   // deve ritornare il negozio registrato sopra
        expect(res.body.products.length).toBe(0);           // non deve ritornare prodotti (filter: "shops")
    });

    it("5.2 Ricerca con nessuna corrispondenza", async () => {
        const res = await request(app)
            .get("/api/v1/search")
            .query({ query: "Manuel"});
        expect(res.status).toBe(200);
        expect(res.body.products.length).toBe(0);
        expect(res.body.shops.length).toBe(0);
    });

    it("5.3 Ricerca senza filtro esplicito", async () => {
        const res = await request(app)
            .get("/api/v1/search")
            .query({ query: "Ciliegia" });

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.products)).toBe(true);
        expect(Array.isArray(res.body.shops)).toBe(true);
        expect(res.body.products.length).toBeGreaterThan(0);    // dovrebbe ritornare il prodotto "Ciliegia" e
        expect(res.body.shops.length).toBeGreaterThan(0);       // il mercante registrato con nome "Ciliegia's shop" in fase di seeding
    });
});
