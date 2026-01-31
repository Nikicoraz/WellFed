import { Jimp } from "jimp";
import app from "../app.js";
import { clearAllPendingTimers } from '../modules/qrcode.js';
import jsQRModule from "jsqr";
import request from "supertest";

// il modulo jsQR in TS/ESM non ha default “callable”, quindi serve cast esplicito
const jsQR = jsQRModule as unknown as (
    data: Uint8ClampedArray,
    width: number,
    height: number
) => { data: string } | null;

// Utilizzato nel TC 6.2
let merchantToken: string;
// Utilizzato nei TC 6.0, 6.1, 6.3
let clientToken: string;
// Utilizzato nei TC 6.0, 6.1, 6.2, 6.3
let shopID: string;

async function generateQrToken(shopID: string, merchantToken: string): Promise<string> {
    // prendo il productID
    const shopProducts = await request(app)
        .get(`/api/v1/shops/${shopID}/products`)
        .set("Authorization", `Bearer ${merchantToken}`);

    if (!shopProducts.body?.length) throw new Error("No products found");
    const productID = shopProducts.body[0].id;

    // creo il qr
    const qrResp = await request(app)
        .post("/api/v1/QRCodes/assignPoints")
        .set("Authorization", `Bearer ${merchantToken}`)
        .send([{ productID, quantity: 2 }]);

    const dataUrl: string = qrResp.text;
    if (!dataUrl.startsWith("data:image/")) throw new Error("Invalid QR Data URL");

    const base64 = dataUrl.split(",")[1];
    if (!base64) throw new Error("Failed to extract QR image data");

    const img = await Jimp.read(Buffer.from(base64, "base64"));

    // Preprocess per stabilità
    img.greyscale().contrast(1);

    const { data, width, height } = img.bitmap;

    // decodifica con jsQR
    const code = jsQR(new Uint8ClampedArray(data), width, height);
    if (!code) throw new Error("QR Code non trovato nell'immagine");

    return code.data;
}

beforeAll(async () => {
    // Registrazione e login commerciante per ricavare shopID e merchantToken validi per l'inserimento di prodotti
    let res = await request(app)
        .post("/api/v1/register/merchant")
        .field("name", "Shop")
        .field("email", "shop@qrtest.com")
        .field("password", "Sicura!123#")
        .field("address", "Via Test")
        .field("partitaIVA", "IT12345678901")
        .attach("image", Buffer.from("img"), "shop.jpg");
    expect(res.status).toBe(202);

    const mLogin = await request(app)
        .post("/api/v1/login")
        .send({ email: "shop@qrtest.com", password: "Sicura!123#" });
    expect(mLogin.status).toBe(200);

    merchantToken = mLogin.body.token;
    const location = mLogin.headers.location!;
    const parts = location.split("/shop/");
    shopID = parts[1]!;

    // Registrazione e login cliente per ricavare clientToken valido
    res = await request(app)
        .post("/api/v1/register/client")
        .send({ username: "cliente", email: "cliente@qrtest.com", password: "Sicura!123#" });
    expect(res.status).toBe(201);

    const cLogin = await request(app)
        .post("/api/v1/login")
        .send({ email: "cliente@qrtest.com", password: "Sicura!123#" });
    clientToken = cLogin.body.token;
    expect(cLogin.status).toBe(200);

    // Inserimento di prodotti con il mercante creato sopra
    res = await request(app)
        .post(`/api/v1/shops/${shopID}/products`)
        .set("Authorization", `Bearer ${merchantToken}`)
        .field("name", "Banana")
        .field("description", "desc")
        .field("origin", "Ecuador")
        .field("points", 10)
        .attach("image", Buffer.from("img"), "banana.jpg");
    expect(res.status).toBe(201);
});

afterAll(async () => {
    await clearAllPendingTimers();
});

describe("Redeem points QR scan Controller", () => {
    it("6.0 Scansione codice QR assegnazione punti", async () => {
        const qrToken = await generateQrToken(shopID, merchantToken);
        const res = await request(app)
            .post("/api/v1/QRCodes/scanned")
            .set("Authorization", `Bearer ${clientToken}`)
            .send({ token: qrToken });

        expect(res.status).toBe(200);
    });

    it("6.1 Scansione codice QR assegnazione punti già utilizzato", async () => {
        const qrToken = await generateQrToken(shopID, merchantToken);
        await request(app)
            .post("/api/v1/QRCodes/scanned")
            .set("Authorization", `Bearer ${clientToken}`)
            .send({ token: qrToken });

        const res = await request(app)
            .post("/api/v1/QRCodes/scanned")
            .set("Authorization", `Bearer ${clientToken}`)
            .send({ token: qrToken });

        expect(res.status).toBe(400);
    });

    it("6.2 Scansione codice QR assegnazione punti da mercante invece che cliente", async () => {
        const qrToken = await generateQrToken(shopID, merchantToken);
        const res = await request(app)
            .post("/api/v1/QRCodes/scanned")
            .set("Authorization", `Bearer ${merchantToken}`)
            .send({ token: qrToken });

        expect(res.status).toBe(400);
    });

    it("6.3 Scansione codice QR assegnazione punti token alternato", async () => {  // Questo test genera un errore su terminale. Non ti curar di lui, ma guarda e passa
        const qrToken = await generateQrToken(shopID, merchantToken);
        const res = await request(app)
            .post("/api/v1/QRCodes/scanned")
            .set("Authorization", `Bearer ${clientToken}`)
            .send({ token: qrToken + "abc" });

        expect(res.status).toBe(400);
    });

});
