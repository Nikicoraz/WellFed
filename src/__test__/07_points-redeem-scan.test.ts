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

let merchantToken: string;
let clientToken: string;
let shopID: string;

async function silenceConsole<T>(fn: () => Promise<T>): Promise<T> {
    const { write: stderrWrite } = process.stderr;
    const { write: stdoutWrite } = process.stdout;

    process.stderr.write = (() => {
        return true;
    }) as never;
    process.stdout.write = (() => {
        return true;
    }) as never;

    try {
        return await fn();
    } finally {
        process.stderr.write = stderrWrite;
        process.stdout.write = stdoutWrite;
    }
}

async function generateQrToken(shopID: string, merchantToken: string): Promise<string> {
    // Prendo il productID
    const shopProducts = await request(app)
        .get(`/api/v1/shops/${shopID}/products`)
        .set("Authorization", `Bearer ${merchantToken}`);
    expect(shopProducts.status).toBe(200);
    const productID = shopProducts.body[0].id;

    const qrResp = await request(app)
        .post("/api/v1/QRCodes/assignPoints")
        .set("Authorization", `Bearer ${merchantToken}`)
        .send([{ productID, quantity: 2 }]);
    expect(qrResp.status).toBe(200);

    const dataUrl: string = qrResp.text!;
    const base64 = dataUrl.split(",")[1]!;
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
    // Registrazione commerciante
    let res = await request(app)
        .post("/api/v1/register/merchant")
        .field("name", "Shop")
        .field("email", "shop@qrtest.com")
        .field("password", "Sicura!123#")
        .field("address", "Via Test")
        .field("partitaIVA", "IT12345678901")
        .attach("image", Buffer.from("img"), "shop.jpg");
    expect(res.status).toBe(202);

    // Login commerciante
    res = await request(app)
        .post("/api/v1/login")
        .send({ email: "shop@qrtest.com", password: "Sicura!123#" });
    expect(res.status).toBe(200);

    merchantToken = res.body.token;
    shopID = res.header.location!.split("/shop/")[1]!;

    // Registrazione cliente
    res = await request(app)
        .post("/api/v1/register/client")
        .send({ username: "cliente", email: "cliente@qrtest.com", password: "Sicura!123#" });
    expect(res.status).toBe(201);

    // Login cliente
    res = await request(app)
        .post("/api/v1/login")
        .send({ email: "cliente@qrtest.com", password: "Sicura!123#" });
    clientToken = res.body.token;
    expect(res.status).toBe(200);

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
    it("7.0 Scansione codice QR per assegnazione punti", async () => {
        const qrToken = await generateQrToken(shopID, merchantToken);
        const res = await request(app)
            .post("/api/v1/QRCodes/scanned")
            .set("Authorization", `Bearer ${clientToken}`)
            .send({ token: qrToken });

        expect(res.status).toBe(200);
    });

    it("7.1 Tentativo di scansione codice QR per assegnazione punti già utilizzato", async () => {
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

    it("7.2 Tentativo di scansione codice QR per assegnazione punti da commerciante invece che cliente", async () => {
        const qrToken = await generateQrToken(shopID, merchantToken);
        const res = await request(app)
            .post("/api/v1/QRCodes/scanned")
            .set("Authorization", `Bearer ${merchantToken}`)
            .send({ token: qrToken });

        expect(res.status).toBe(400);
    });

    it("7.3 Tentativo di scansione codice QR per assegnazione punti con token alternato/invalido", async () => {  
        await silenceConsole(async () => {
            const qrToken = await generateQrToken(shopID, merchantToken);
            const res = await silenceConsole(() => {
                return request(app)
                    .post("/api/v1/QRCodes/scanned")
                    .set("Authorization", `Bearer ${clientToken}`)
                    .send({ token: qrToken + "abc" });
            });
            expect(res.status).toBe(400);
        });
    });
});
