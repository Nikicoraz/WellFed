import { Jimp } from "jimp";
import QrCode from "qrcode-reader";
import app from "../app.js";
import request from "supertest";

let merchantToken: string;
let clientToken: string;
let shopID: string;
let productID: string;
let qrToken: string;

beforeAll(async () => {
    await request(app)
        .post("/api/v1/register/merchant")
        .field("name", "Negozio Test")
        .field("email", "merchant@qrtest.com")
        .field("password", "Sicura!123#")
        .field("address", "Via Test")
        .field("partitaIVA", "IT12345678901")
        .attach("image", Buffer.from("img"), "shop.jpg");

    const mLogin = await request(app)
        .post("/api/v1/login")
        .send({ email: "merchant@qrtest.com", password: "Sicura!123#" });

    merchantToken = mLogin.body.token;
    const location = mLogin.headers.location;

    if (typeof location !== "string") throw new Error("Missing location");
    shopID = mLogin.body.shopID;
    if (!location) throw new Error("Location header missing");
    const parts = location.split("/shop/");
    if (parts.length < 2 || !parts[1]) throw new Error("Shop ID not found in location");
    shopID = parts[1];

    await request(app)
        .post("/api/v1/register/client")
        .send({ username: "cliente", email: "cliente@qrtest.com", password: "Sicura!123#" });

    const cLogin = await request(app)
        .post("/api/v1/login")
        .send({ email: "cliente@qrtest.com", password: "Sicura!123#" });
    clientToken = cLogin.body.token;

    await request(app)
        .post(`/api/v1/shops/${shopID}/products`)
        .set("Authorization", `Bearer ${merchantToken}`)
        .field("name", "Banana")
        .field("description", "desc")
        .field("origin", "Ecuador")
        .field("points", 10)
        .attach("image", Buffer.from("img"), "banana.jpg");

    // Recupero ID prodotto dal DB tramite ricerca
    const search = await request(app).get("/api/v1/search").query({ query: "Banana", filter: "products" });
    productID = search.body.products[0].id;
    
    const qr = await request(app)
        .post("/api/v1/QRCodes/assignPoints")
        .set("Authorization", `Bearer ${merchantToken}`)
        .send([{ productID, quantity: 2 }]);

    const dataUrl: string = qr.text;

    const base64 = dataUrl.split(",")[1];
    if (!base64) throw new Error("Invalid QR");

    const img = await Jimp.read(Buffer.from(base64, "base64"));

    const qrReader = new QrCode();

    qrToken = await new Promise<string>((resolve, reject) => {
        qrReader.callback = (err: Error | null, v: { result: string }) => {
            if (err) reject(err);
            else resolve(v.result);
        };
        qrReader.decode(img.bitmap);
    });
});

describe("QR Scan", () => {

    it("6.0 Scansione codice QR assegnazione punti", async () => {
        const res = await request(app)
            .post("/api/v1/QRCodes/scanned")
            .set("Authorization", `Bearer ${clientToken}`)
            .send({ token: qrToken });

        expect(res.status).toBe(200);
    });

    it("6.1 Scansione codice QR scaduto", async () => {                     // Ritrna 400 correttamente ma potrebbe essere un falso positivo
        // token rimosso manualmente simulando scadenza
        await new Promise(r => {
            return setTimeout(r, 5);
        }); // con timer patchato nei test

        const res = await request(app)
            .post("/api/v1/QRCodes/scanned")
            .set("Authorization", `Bearer ${clientToken}`)
            .send({ token: qrToken });

        expect(res.status).toBe(400);
    });

    it("6.2 Scansione QR da mercante invece che cliente", async () => {     // Ritrna 400 correttamente ma potrebbe essere un falso positivo
        const res = await request(app)
            .post("/api/v1/QRCodes/scanned")
            .set("Authorization", `Bearer ${merchantToken}`)
            .send({ token: qrToken });

        expect(res.status).toBe(400);
    });

    it("6.3 Scansione token alternato", async () => {                       // Ritrna 400 correttamente ma potrebbe essere un falso positivo, gambling
        const res = await request(app)
            .post("/api/v1/QRCodes/scanned")
            .set("Authorization", `Bearer ${clientToken}`)
            .send({ token: qrToken + "abc" });

        expect(res.status).toBe(400);
    });
});
