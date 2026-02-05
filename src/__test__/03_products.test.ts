import app from "../app.js";
import request from "supertest";

let clientToken: string;
let merchantToken: string;
let shopID: string;
let merchantToken2: string;
let shopID2: string;
let productID: string;

beforeAll(async () => {
    // Registrazione e login commerciante1 per ricavare shopID e merchantToken validi per l'inserimento di prodotti
    let res = await request(app)
        .post("/api/v1/register/merchant")
        .field("name", "Shop")
        .field("email", "shop@test.com")
        .field("password", "Sicura!123#")
        .field("address", "Via Test")
        .field("partitaIVA", "IT12345678901")
        .attach("image", Buffer.from("img"), "shop.jpg");
    expect(res.status).toBe(202);

    res = await request(app)
        .post("/api/v1/login")
        .send({ email: "shop@test.com", password: "Sicura!123#" });
    expect(res.status).toBe(200);

    merchantToken = res.body.token;
    shopID = res.header.location!.split("/shop/")[1]!;

    // Registrazione e login commerciante2 per ricavare shopID e merchantToken validi per l'inserimento di prodotti
    res = await request(app)
        .post("/api/v1/register/merchant")
        .field("name", "Shop2")
        .field("email", "shop2@test.com")
        .field("password", "Sicura!123#")
        .field("address", "Via Test")
        .field("partitaIVA", "IT12345678901")
        .attach("image", Buffer.from("img"), "shop.jpg");
    expect(res.status).toBe(202);

    res = await request(app)
        .post("/api/v1/login")
        .send({ email: "shop2@test.com", password: "Sicura!123#" });
    expect(res.status).toBe(200);

    merchantToken2 = res.body.token;
    shopID2 = res.header.location!.split("/shop/")[1]!;

    // Registrazione e login cliente per ricavare clientToken valido
    res = await request(app).post('/api/v1/register/client').send({
        username: 'cliente',
        email: 'cliente@test.com',
        password: 'Sicura!123#'
    });
    expect(res.status).toBe(201);

    res = await request(app)
        .post('/api/v1/login')
        .send({
            email: 'cliente@test.com',
            password: 'Sicura!123#'
        });
    expect(res.status).toBe(200);

    clientToken = res.body.token;
});

describe("Products Controller", () => {
    it("3.0 Aggiunta di un nuovo prodotto con dati completi", async () => {
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

    it("3.1 Tentativo di aggiunta di un prodotto con uno o più campi vuoti", async () => {
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

    it("3.2 Tentativo di aggiunta prodotto da parte di un cliente (Atuenticato)", async () => {
        const res = await request(app)
            .post(`/api/v1/shops/${shopID}/products`)
            .set("Authorization", `Bearer ${clientToken}`)
            .field("name", "Test")
            .field("description", "desc")
            .field("origin", "Italia")
            .field("points", 10)
            .attach("image", Buffer.from("img"), "test.jpg");

        expect(res.status).toBe(401);
    });

    it("3.3 Tentativo di aggiunta prodotto da un commerciante nel negozio di un altro commerciante", async () => {
        const res = await request(app)
            .post(`/api/v1/shops/${shopID2}/products`)
            .set("Authorization", `Bearer ${merchantToken}`)
            .field("name", "Mela")
            .field("description", "desc")
            .field("origin", "Italia")
            .field("points", 10)
            .attach("image", Buffer.from("img"), "mela.jpg");

        expect(res.status).toBe(401);
    });

    it("3.4 Tentativo di eliminazione di un prodotto con token di autorizzazione legato ad un altro negozio", async () => {
        let res = await request(app)
            .get(`/api/v1/shops/${shopID}/products`);
        expect(res.status).toBe(200);
        productID = res.body[0].id; // <--Dovrebbe esserci la mela aggiunta nel test 3.0
        
        res = await request(app)
            .delete(`/api/v1/shops/${shopID}/products/${productID}`)
            .set("Authorization", `Bearer ${merchantToken2}`);
        expect(res.status).toBe(401);
    });

    it("3.5 Eliminazione di un prodotto valida", async () => {
        const res = await request(app)
            .delete(`/api/v1/shops/${shopID}/products/${productID}`)
            .set("Authorization", `Bearer ${merchantToken}`);
        expect(res.status).toBe(200);
    });

    it("3.6 Tentativo di eliminazione di un prodotto inesistente/già eliminato", async () => {
        const res = await request(app)
            .delete(`/api/v1/shops/${shopID}/products/${productID}`)
            .set("Authorization", `Bearer ${merchantToken}`);
        expect(res.status).toBe(404);
    });
});