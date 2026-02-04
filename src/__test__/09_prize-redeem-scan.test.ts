import request, { type Response } from "supertest";
import { Jimp } from "jimp";
import app from "../app.js";
import { clearAllPendingTimers } from '../modules/qrcode.js';
import jsQRModule from "jsqr";

// il modulo jsQR in TS/ESM non ha default “callable”, quindi serve cast esplicito
const jsQR = jsQRModule as unknown as (
    data: Uint8ClampedArray,
    width: number,
    height: number
) => { data: string } | null;

const PTS_PER_PRODUCT = 10;
const PRODUCTS_BOUGHT = 3;
const PTS_PER_PRIZE = 10;

let merchantToken: string;
let clientToken: string;
let shopID: string;

let redeemed = 0;

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

async function checkClientPoints() {
    const res = await request(app)
        .get("/api/v1/client")
        .set("Authorization", `Bearer ${clientToken}`);

    const expected = PTS_PER_PRODUCT * PRODUCTS_BOUGHT - redeemed * PTS_PER_PRIZE;
    expect(res.body.points[shopID]).toBe(expected);
}

async function decodeQRJWT(dataUrl: string): Promise<string> {
    const base64 = dataUrl.split(",")[1]!;
    const img = await Jimp.read(Buffer.from(base64, "base64"));
    img.greyscale().contrast(1);
    const { data, width, height } = img.bitmap;
    const code = jsQR(new Uint8ClampedArray(data), width, height)!;
    if (!code) throw new Error("QR decode failed");
    return code.data;
}

async function expectPngQR(res: Response): Promise<string> {
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/^data:image\/png;base64,/);

    const decoded = await decodeQRJWT(res.text);
    return decoded;
}

async function createPrizeAndGetID(): Promise<string> {
    // Aggiungo un premio
    const prizeRes = await request(app)
        .post(`/api/v1/shops/${shopID}/prizes`)
        .set("Authorization", `Bearer ${merchantToken}`)
        .field("name", "Premio Test")
        .field("description", "Premio descrizione")
        .field("points", PTS_PER_PRIZE)
        .attach("image", Buffer.from("img"), "prize.jpg");
    expect(prizeRes.status).toBe(201);

    const shopData = await request(app)
        .get(`/api/v1/shops/${shopID}/prizes`);

    return shopData.body.at(-1).id;
}

async function generateRedeemQR(): Promise<string> {
    const prizeID = await createPrizeAndGetID();

    const qrResp = await request(app)
        .post("/api/v1/QRCodes/redeemPrize")
        .set("Authorization", `Bearer ${clientToken}`)
        .send({ prizeID });

    return await expectPngQR(qrResp);
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

    res = await request(app)
        .post("/api/v1/login")
        .send({ email: "shop@test.com", password: "Sicura!123#" });
    expect(res.status).toBe(200);

    merchantToken = res.body.token;
    shopID = res.header.location!.split("/shop/")[1]!;

    // Inserimento prodotto
    res = await request(app)
        .post(`/api/v1/shops/${shopID}/products`)
        .set("Authorization", `Bearer ${merchantToken}`)
        .field("name", "Arancia")
        .field("description", "Arancia arancione")
        .field("origin", "Trento")
        .field("points", PTS_PER_PRODUCT)
        .attach("image", Buffer.from("img"), "mirtillo.jpg");
    expect(res.status).toBe(201);

    // Prendo il productID
    res = await request(app)
        .get(`/api/v1/shops/${shopID}/products`)
        .set("Authorization", `Bearer ${merchantToken}`);
    const productID = res.body[0].id;

    // QR per assegnare punti al client
    res = await request(app)
        .post("/api/v1/QRCodes/assignPoints")
        .set("Authorization", `Bearer ${merchantToken}`)
        .send([{ productID, quantity: PRODUCTS_BOUGHT }]);
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/^data:image\/png;base64,/);

    const jwtreq = await decodeQRJWT(res.text);

    // Registrazione e accesso cliente
    res = await request(app)
        .post("/api/v1/register/client")
        .send({ username: "cliente", email: "cliente@test.com", password: "Sicura!123#" });
    expect(res.status).toBe(201);

    res = await request(app)
        .post("/api/v1/login")
        .send({ email: "cliente@test.com", password: "Sicura!123#" });
    expect(res.status).toBe(200);

    clientToken = res.body.token;

    // Assegno punti al cliente
    res = await request(app)
        .post("/api/v1/QRCodes/scanned")
        .set("Authorization", `Bearer ${clientToken}`)
        .send({ token: jwtreq });
    expect(res.status).toBe(200);
});

afterAll(async () => {
    await clearAllPendingTimers();
});

describe("Redeem prize QR scan Controller", () => {
    it("9.0 Scansione codice QR per ritiro premio con sufficienti punti", async () => {
        const token = await generateRedeemQR();
        const res = await request(app)
            .post("/api/v1/QRCodes/scanned")
            .set("Authorization", `Bearer ${merchantToken}`)
            .send({ token });
        expect(res.status).toBe(200);

        redeemed++;
        await checkClientPoints();
    });

    it("9.1 Tentativo di scansione codice QR per ritiro premio già utilizzato", async () => {
        const token = await generateRedeemQR();
        let res = await request(app)
            .post("/api/v1/QRCodes/scanned")
            .set("Authorization", `Bearer ${merchantToken}`)
            .send({ token });
        expect(res.status).toBe(200);

        redeemed++;
        await checkClientPoints();

        res = await request(app)
            .post("/api/v1/QRCodes/scanned")
            .set("Authorization", `Bearer ${merchantToken}`)
            .send({ token });
        expect(res.status).toBe(400);
        await checkClientPoints();
    });

    it("9.2 Tentativo di scansione codice QR per ritiro premio da cliente invece che commerciante", async () => {
        const token = await generateRedeemQR();
        const res = await request(app)
            .post("/api/v1/QRCodes/scanned")
            .set("Authorization", `Bearer ${clientToken}`)
            .send({ token });
        expect(res.status).toBe(400);
        await checkClientPoints();
    });

    it("9.3 Tentativo di scansione codice QR per ritiro premio con token alternato/invalido", async () => {
        const token = await generateRedeemQR();
        const res = await silenceConsole(() => {
            return request(app)
                .post("/api/v1/QRCodes/scanned")
                .set("Authorization", `Bearer ${merchantToken}`)
                .send({ token: token + "abc" });
        });

        expect(res.status).toBe(400);
        await checkClientPoints();
    });
});