import { Jimp } from "jimp";
import QrCode from "qrcode-reader";
import app from "../app.js";
import request from "supertest";

// Utilizzato nei TC 7.0, 7.1, 7.2, 7.3, 7.4
let clientToken: string;
// Utilizzato nei TC 7.0, 7.5, 7.6
let prizeID: string;
// Utilizzato nel TC 7.2
let bigPrizeID: string;

// Parameters
const ppp = 10;         // Points assigned per units bought
const p = 2;            // units bought
const prp = 15;         // points needed to reedem the prize which the customer should be able to redeem    (ppp*p >= prp)
const bigprp = 100;     // points needed to reedem the prize which the customer shouldn't be able to redeem (ppp*p < bigprp)

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

    const mLogin = await request(app)
        .post("/api/v1/login")
        .send({ email: "shop@test.com", password: "Sicura!123#" });

    const merchantToken = mLogin.body.token;
    const location = mLogin.header.location;    if (!location) throw new Error("Location header missing");
    const parts = location.split("/shop/");     if (parts.length < 2 || !parts[1]) throw new Error("Shop ID not found");
    const shopID = parts[1];

    // Genero dei premi con il merchantToken ricavato sopra
    let prizeRes = await request(app)
        .post(`/api/v1/shops/${shopID}/prizes`)
        .set("Authorization", `Bearer ${merchantToken}`)
        .field("name", "Premio Test")
        .field("description", "Premio descrizione")
        .field("points", prp)
        .attach("image", Buffer.from("img"), "prize.jpg");
    expect(prizeRes.status).toBe(201);

    prizeRes = await request(app)
        .post(`/api/v1/shops/${shopID}/prizes`)
        .set("Authorization", `Bearer ${merchantToken}`)
        .field("name", "Premio Grande Test")
        .field("description", "Premio descrizione")
        .field("points", bigprp)
        .attach("image", Buffer.from("img"), "prize.jpg");
    expect(prizeRes.status).toBe(201);

    // Recupero i prizeID dallo shop 
    const shopData = await request(app).get(`/api/v1/shops/${shopID}/prizes`);
    prizeID = shopData.body[0].id;
    bigPrizeID = shopData.body[1].id;
    
    // Inserimento di prodotti con il mercante creato sopra
    await request(app)
        .post(`/api/v1/shops/${shopID}/products`)
        .set("Authorization", `Bearer ${merchantToken}`)
        .field("name", "Banana")
        .field("description", "desc")
        .field("origin", "Ecuador")
        .field("points", ppp)
        .attach("image", Buffer.from("img"), "banana.jpg");

    // Trovo il productID per generare il QR
    const shopProducts = await request(app)
        .get(`/api/v1/shops/${shopID}/products`)
        .set("Authorization", `Bearer ${merchantToken}`);
    const productID = shopProducts.body[0].id;

    // Registrazione e login cliente per ricavare clientToken valido
    await request(app)
        .post("/api/v1/register/client")
        .send({
            username: "cliente",
            email: "cliente@test.com",
            password: "Sicura!123#"
        });

    const cLogin = await request(app)
        .post("/api/v1/login")
        .send({ email: "cliente@test.com", password: "Sicura!123#" });
    clientToken = cLogin.body.token;

    // Genero il codice QR per assegnare punti al cliente
    const qrResp = await request(app)
        .post("/api/v1/QRCodes/assignPoints")
        .set("Authorization", `Bearer ${merchantToken}`)
        .send([{ productID, quantity: p }]);

    const dataUrl: string = qrResp.text;    if (!dataUrl.startsWith("data:image/")) throw new Error("Invalid QR Data URL");

    // Decodifico l'immagine del QR per estrarre il JWT token
    const base64 = dataUrl.split(",")[1];   if (!base64) throw new Error("Failed to extract QR image data");
    const img = await Jimp.read(Buffer.from(base64, "base64"));
    const qrReader = new QrCode();
    const qrToken = await new Promise<string>((resolve, reject) => {
        qrReader.callback = (err, value) => {
            if (err) reject(err);
            else resolve(value.result);
        };
        qrReader.decode(img.bitmap);
    });

    const res = await request(app)
        .post("/api/v1/QRCodes/scanned")
        .set("Authorization", `Bearer ${clientToken}`)
        .send({ token: qrToken });
    expect(res.status).toBe(200);
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

    it("7.1 Generazione QR per riscossione premio con non abbastanza punti a disposizione", async () => {
        const res = await request(app)
            .post("/api/v1/QRCodes/redeemPrize")
            .set("Authorization", `Bearer ${clientToken}`)
            .send({ prizeID: bigPrizeID });
        expect(res.status).toBe(402);
    });

    it("7.2 Generazione QR per riscossione premio con campo prizeID vuoto", async () => {
        const res = await request(app)
            .post("/api/v1/QRCodes/redeemPrize")
            .set("Authorization", `Bearer ${clientToken}`)
            .send({ prizeID: "" });

        expect(res.status).toBe(400);
    });

    it("7.3 Generazione QR per riscossione premio con prizeID farlocco", async () => {
        const res = await request(app)
            .post("/api/v1/QRCodes/redeemPrize")
            .set("Authorization", `Bearer ${clientToken}`)
            .send({ prizeID: "123456789012345678901234" });

        expect(res.status).toBe(404);
    });

    it("7.4 Generazione QR per riscossione premio senza token autorizzazione", async () => {
        const res = await request(app)
            .post("/api/v1/QRCodes/redeemPrize")
            .send({ prizeID });

        expect(res.status).toBe(401);
    });

    it("7.5 Generazione QR per riscossione premio con token autorizzazione invalido", async () => {
        const res = await request(app)
            .post("/api/v1/QRCodes/redeemPrize")
            .set("Authorization", "Bearer invalid.token")
            .send({ prizeID });

        expect(res.status).toBe(401);
    });
});
