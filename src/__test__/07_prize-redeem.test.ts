import { Jimp } from "jimp";
import app from "../app.js";
import { clearAllPendingTimers } from '../modules/qrcode.js';
import jsQRModule from "jsqr";
import request from "supertest";

// Casting TS per rendere jsQR callable
const jsQR = jsQRModule as unknown as (
    data: Uint8ClampedArray,
    width: number,
    height: number
) => { data: string } | null;

// Utilizzato nei TC 7.0, 7.1, 7.2, 7.3, 7.4
let clientToken: string;
// Utilizzato nei TC 7.0, 7.5, 7.6
let prizeID: string;
// Utilizzato nel TC 7.2
let bigPrizeID: string;

// Parameters
const ppp = 10;         // Points assigned per units bought
const p = 2;            // units bought
const prp = 15;         // points needed to redeem the prize
const bigprp = 100;     // points needed to redeem the big prize

// Funzione helper per generare e decodificare QR in JWT
async function generateQrToken(productID: string, merchantToken: string): Promise<string> {
    const qrResp = await request(app)
        .post("/api/v1/QRCodes/assignPoints")
        .set("Authorization", `Bearer ${merchantToken}`)
        .send([{ productID, quantity: p }]);
    expect(qrResp.status).toBe(200);

    const dataUrl: string = qrResp.text;
    if (!dataUrl.startsWith("data:image/")) throw new Error("Invalid QR Data URL");

    const base64 = dataUrl.split(",")[1];
    if (!base64) throw new Error("Failed to extract QR image data");

    const img = await Jimp.read(Buffer.from(base64, "base64"));
    img.greyscale().contrast(1);

    const { data, width, height } = img.bitmap;
    const code = jsQR(new Uint8ClampedArray(data), width, height);
    if (!code) throw new Error("QR Code non trovato nell'immagine");

    return code.data;
}

beforeAll(async () => {
    // Registrazione e login commerciante
    let res = await request(app)
        .post("/api/v1/register/merchant")
        .field("name", "Shop")
        .field("email", "shop@test.com")
        .field("password", "Sicura!123#")
        .field("address", "Via Test")
        .field("partitaIVA", "IT12345678901")
        .attach("image", Buffer.from("img"), "shop.jpg");
    expect(res.status).toBe(202);

    const mLogin = await request(app)
        .post("/api/v1/login")
        .send({ email: "shop@test.com", password: "Sicura!123#" });
    expect(mLogin.status).toBe(200);

    const merchantToken = mLogin.body.token;
    const location = mLogin.header.location!;
    const parts = location.split("/shop/");
    const shopID = parts[1];

    // Genero premi
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

    const shopData = await request(app).get(`/api/v1/shops/${shopID}/prizes`);
    prizeID = shopData.body[0].id;
    bigPrizeID = shopData.body[1].id;

    // Inserimento prodotti
    res = await request(app)
        .post(`/api/v1/shops/${shopID}/products`)
        .set("Authorization", `Bearer ${merchantToken}`)
        .field("name", "Banana")
        .field("description", "desc")
        .field("origin", "Ecuador")
        .field("points", ppp)
        .attach("image", Buffer.from("img"), "banana.jpg");
    expect(res.status).toBe(201);

    const shopProducts = await request(app)
        .get(`/api/v1/shops/${shopID}/products`)
        .set("Authorization", `Bearer ${merchantToken}`);
    const productID = shopProducts.body[0].id;

    // Registrazione cliente
    res = await request(app)
        .post("/api/v1/register/client")
        .send({ username: "cliente", email: "cliente@test.com", password: "Sicura!123#" });
    expect(res.status).toBe(201);

    const cLogin = await request(app)
        .post("/api/v1/login")
        .send({ email: "cliente@test.com", password: "Sicura!123#" });
    clientToken = cLogin.body.token;
    expect(cLogin.status).toBe(200);

    // Genero e scansiono QR per assegnazione punti
    const qrToken = await generateQrToken(productID, merchantToken);

    res = await request(app)
        .post("/api/v1/QRCodes/scanned")
        .set("Authorization", `Bearer ${clientToken}`)
        .send({ token: qrToken });
    expect(res.status).toBe(200);
});

afterAll(async () => {
    await clearAllPendingTimers();
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
