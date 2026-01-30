import app from "../app.js";
import request from "supertest";

// Utilizzato nei TC 7.0, 7.1, 7.2, 7.3
let clientToken: string;
// Utilizzato nei TC 7.0, 7.4, 7.5
let prizeID: string;

beforeAll(async () => {
    // Registrazione e login commerciante per ricavare shopID e merchantToken validi per l'inserimento di prodotti
    await request(app)
        .post("/api/v1/register/merchant")
        .field("name", "Shop")
        .field("email", "shop@test.com")
        .field("password", "Sicura!123#")
        .field("address", "Via Test")
        .field("partitaIVA", "IT12345678901")
        .attach("image", Buffer.from("img"), "shop.jpg");

    const merchantLogin = await request(app)
        .post("/api/v1/login")
        .send({ email: "shop@test.com", password: "Sicura!123#" });

    const merchantToken = merchantLogin.body.token;

    const location = merchantLogin.header.location;
    if (!location) throw new Error("Location header missing");
    const parts = location.split("/shop/");
    if (parts.length < 2 || !parts[1]) throw new Error("Shop ID not found");
    const shopID = parts[1];

    // Genero un  premio con il merchantToken ricavato sopra
    const prizeRes = await request(app)
        .post(`/api/v1/shops/${shopID}/prizes`)
        .set("Authorization", `Bearer ${merchantToken}`)
        .field("name", "Premio Test")
        .field("description", "Premio descrizione")
        .field("points", 50)
        .attach("image", Buffer.from("img"), "prize.jpg");

    expect(prizeRes.status).toBe(201);

    // Recupero prizeID dallo shop 
    const shopData = await request(app).get(`/api/v1/shops/${shopID}/prizes`);
    prizeID = shopData.body[0].id;

    // Registrazione e login cliente per ricavare clientToken valido
    await request(app)
        .post("/api/v1/register/client")
        .send({
            username: "cliente",
            email: "cliente@test.com",
            password: "Sicura!123#"
        });

    const clientLogin = await request(app)
        .post("/api/v1/login")
        .send({ email: "cliente@test.com", password: "Sicura!123#" });

    clientToken = clientLogin.body.token;
});

describe("QR Redeem Prize", () => {

    it("7.0 Generazione QR per riscossione premio valida", async () => {
        const res = await request(app)
            .post("/api/v1/QRCodes/redeemPrize")
            .set("Authorization", `Bearer ${clientToken}`)
            .send({ prizeID });

        expect(res.status).toBe(200);
        expect(res.text).toMatch(/^data:image\/png;base64,/);
    });

    it("7.1 prizeID mancante", async () => {
        const res = await request(app)
            .post("/api/v1/QRCodes/redeemPrize")
            .set("Authorization", `Bearer ${clientToken}`)
            .send({});

        expect(res.status).toBe(400);
    });

    it("7.2 prizeID vuoto", async () => {
        const res = await request(app)
            .post("/api/v1/QRCodes/redeemPrize")
            .set("Authorization", `Bearer ${clientToken}`)
            .send({ prizeID: "" });

        expect(res.status).toBe(400);
    });

    it("7.3 Premio inesistente", async () => {
        const res = await request(app)
            .post("/api/v1/QRCodes/redeemPrize")
            .set("Authorization", `Bearer ${clientToken}`)
            .send({ prizeID: "123456789012345678901234" });

        expect(res.status).toBe(404);
    });

    it("7.4 Utente non autenticato", async () => {
        const res = await request(app)
            .post("/api/v1/QRCodes/redeemPrize")
            .send({ prizeID });

        expect(res.status).toBe(401);
    });

    it("7.5 Token non valido", async () => {
        const res = await request(app)
            .post("/api/v1/QRCodes/redeemPrize")
            .set("Authorization", "Bearer invalid.token")
            .send({ prizeID });

        expect(res.status).toBe(401);
    });
});
