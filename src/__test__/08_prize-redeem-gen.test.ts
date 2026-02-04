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

let clientToken: string;
let prizeID: string;
let bigPrizeID: string;

// Parameters
const PTS_PER_PRODUCT = 10;         // Points assigned per units bought
const PRODUCTS_BOUGHT = 2;            // units bought
const PTS_PER_PRIZE = 15;         // points needed to redeem the prize
const PTS_PER_BIGPRIZE = 100;     // points needed to redeem the big prize

// Decode QR JWT from data URL
async function decodeQRDataUrl(dataUrl: string): Promise<string> {
    const [, base64] = dataUrl.split(",");
    if (!base64) throw new Error("Invalid data URL for QR decode");

    const img = await Jimp.read(Buffer.from(base64, "base64"));
    img.greyscale().contrast(1);

    const { data, width, height } = img.bitmap;
    const code = jsQR(new Uint8ClampedArray(data), width, height);
    if (!code) throw new Error("QR decode failed: no QR code found");

    return code.data;
}

async function generateQrToken(productID: string, merchantToken: string): Promise<string> {
    const res = await request(app)
        .post("/api/v1/QRCodes/assignPoints")
        .set("Authorization", `Bearer ${merchantToken}`)
        .send([{ productID, quantity: PRODUCTS_BOUGHT }]);
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/^data:image\/png;base64,/);

    return await decodeQRDataUrl(res.text);
}

beforeAll(async () => {
    // Registrazione commerciante
    let res = await request(app)
        .post("/api/v1/register/merchant")
        .field("name", "Shop")
        .field("email", "shop@test.com")
        .field("password", "Sicura!123#")
        .field("address", "Via Test")
        .field("partitaIVA", "IT12345678901")
        .attach("image", Buffer.from("img"), "shop.jpg");
    expect(res.status).toBe(202);

    // Login commerciante
    const mLogin = await request(app)
        .post("/api/v1/login")
        .send({ email: "shop@test.com", password: "Sicura!123#" });
    expect(mLogin.status).toBe(200);

    const merchantToken = mLogin.body.token;
    const shopID = mLogin.header.location!.split("/shop/")[1];

    // Genero premi
    const prizes = [
        { name: "Premio Test", points: PTS_PER_PRIZE },
        { name: "Premio  Grande Test", points: PTS_PER_BIGPRIZE }
    ];

    for (const p of prizes) {
        const prizeRes = await request(app)
            .post(`/api/v1/shops/${shopID}/prizes`)
            .set("Authorization", `Bearer ${merchantToken}`)
            .field("name", p.name)
            .field("description", "Premio descrizione")
            .field("points", p.points)
            .attach("image", Buffer.from("img"), "prize.jpg");
        expect(prizeRes.status).toBe(201);
    }

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
        .field("points", PTS_PER_PRODUCT)
        .attach("image", Buffer.from("img"), "banana.jpg");
    expect(res.status).toBe(201);

    res = await request(app)
        .get(`/api/v1/shops/${shopID}/products`)
        .set("Authorization", `Bearer ${merchantToken}`);
    const productID = res.body[0].id;

    // Registrazione cliente
    res = await request(app)
        .post("/api/v1/register/client")
        .send({ username: "cliente", email: "cliente@test.com", password: "Sicura!123#" });
    expect(res.status).toBe(201);

    res = await request(app)
        .post("/api/v1/login")
        .send({ email: "cliente@test.com", password: "Sicura!123#" });
    expect(res.status).toBe(200);
    clientToken = res.body.token;

    // Assign points to client
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

describe("Redeem prize QR generation Controller", () => {
    it("8.0 Generazione QR per riscossione premio valida", async () => {
        const res = await request(app)
            .post("/api/v1/QRCodes/redeemPrize")
            .set("Authorization", `Bearer ${clientToken}`)
            .send({ prizeID });

        expect(res.status).toBe(200);
        expect(res.text).toMatch(/^data:image\/png;base64,/);
    });

    it("8.1 Tentativo di generazione codice QR per riscossione premio con non abbastanza punti a disposizione", async () => {
        const res = await request(app)
            .post("/api/v1/QRCodes/redeemPrize")
            .set("Authorization", `Bearer ${clientToken}`)
            .send({ prizeID: bigPrizeID });
        
        expect(res.status).toBe(402);
    });

    it("8.2 Tentativo di generazione codice QR per riscossione premio con campo prizeID vuoto", async () => {
        const res = await request(app)
            .post("/api/v1/QRCodes/redeemPrize")
            .set("Authorization", `Bearer ${clientToken}`)
            .send({ prizeID: "" });

        expect(res.status).toBe(400);
    });

    it("8.3 Tentativo di generazione codice QR per riscossione premio con prizeID farlocco", async () => {
        const res = await request(app)
            .post("/api/v1/QRCodes/redeemPrize")
            .set("Authorization", `Bearer ${clientToken}`)
            .send({ prizeID: "123456789012345678901234" });

        expect(res.status).toBe(404);
    });

    it("8.4 Tentativo di generazione codice QR per riscossione premio senza token autorizzazione", async () => {
        const res = await request(app)
            .post("/api/v1/QRCodes/redeemPrize")
            .send({ prizeID });

        expect(res.status).toBe(401);
    });

    it("8.5 Tentativo di generazione codice QR per riscossione premio con token autorizzazione invalido", async () => {
        const res = await request(app)
            .post("/api/v1/QRCodes/redeemPrize")
            .set("Authorization", "Bearer invalid.token")
            .send({ prizeID });

        expect(res.status).toBe(401);
    });
});
