import app from "../app.js";
import request from "supertest";

let merchantToken: string;
let shopID: string;
let merchantToken2: string;
let shopID2: string;
let clientToken: string;
let prizeID: string;

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

describe("Prizes Controller", () => {
    it("4.0 Aggiunta di un nuovo premio con dati completi", async () => {
        const res = await request(app)
            .post(`/api/v1/shops/${shopID}/prizes`)
            .set("Authorization", `Bearer ${merchantToken}`)
            .field("name", "Premio Test")
            .field("description", "Premio descrizione")
            .field("points", 10)
            .attach("image", Buffer.from("img"), "prize.jpg");
        expect(res.status).toBe(201);
    });

    it("4.1 Aggiunta di un premio con uno o più campi vuoti", async () => {
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

    it("4.2 Tentativo di aggiunta prodotto da parte di un cliente (autenticato)", async () => {
        const res = await request(app)
            .post(`/api/v1/shops/${shopID}/prizes`)
            .set("Authorization", `Bearer ${clientToken}`)
            .field("name", "Premio Test2")
            .field("description", "Premio descrizione")
            .field("points", 10)
            .attach("image", Buffer.from("img"), "prize2.jpg");
        expect(res.status).toBe(401);
    });

    it("4.3 Tentativo di aggiunta premio da un commerciante nel negozio di un altro commerciante", async () => {
        const res = await request(app)
            .post(`/api/v1/shops/${shopID2}/prizes`)
            .set("Authorization", `Bearer ${merchantToken}`)
            .field("name", "Premio Test3")
            .field("description", "Premio descrizione")
            .field("points", 10)
            .attach("image", Buffer.from("img"), "prize3.jpg");
        expect(res.status).toBe(401);
    });

    it("4.4 Tentativo di eliminazione di un prodotto con token di autorizzazione legato ad un altro negozio", async () => {
        let res = await request(app)
            .get(`/api/v1/shops/${shopID}/prizes`);
        expect(res.status).toBe(200);
        prizeID = res.body[0].id; 
        
        res = await request(app)
            .delete(`/api/v1/shops/${shopID}/prizes/${prizeID}`)
            .set("Authorization", `Bearer ${merchantToken2}`);
        expect(res.status).toBe(401);
    });

    it("4.5 Eliminazione di un prodotto valida", async () => {
        const res = await request(app)
            .delete(`/api/v1/shops/${shopID}/prizes/${prizeID}`)
            .set("Authorization", `Bearer ${merchantToken}`);
        expect(res.status).toBe(200);
    });

    it("4.6 Tentativo di eliminazione di un prodotto inesistente/già eliminato", async () => {
        const res = await request(app)
            .delete(`/api/v1/shops/${shopID}/prizes/${prizeID}`)
            .set("Authorization", `Bearer ${merchantToken}`);
        expect(res.status).toBe(404);
    });
});