import { Jimp } from "jimp";
import QrCode from "qrcode-reader";
import app from "../app.js";
import request from "supertest";

// Utilizzato nel TC 6.2
let merchantToken: string;
// Utilizzato nei TC 6.0, 6.1, 6.3
let clientToken: string;
// Utilizzato nei TC 6.0, 6.1, 6.2, 6.3
let qrToken: string;

beforeAll(async () => {
    // Registrazione e login commerciante per ricavare shopID e merchantToken validi per l'inserimento di prodotti
    await request(app)
        .post("/api/v1/register/merchant")
        .field("name", "Shop")
        .field("email", "shop@qrtest.com")
        .field("password", "Sicura!123#")
        .field("address", "Via Test")
        .field("partitaIVA", "IT12345678901")
        .attach("image", Buffer.from("img"), "shop.jpg");

    const mLogin = await request(app)
        .post("/api/v1/login")
        .send({ email: "shop@qrtest.com", password: "Sicura!123#" });

    merchantToken = mLogin.body.token;
    const location = mLogin.headers.location;
    if (!location) throw new Error("Location header missing");
    const mParts = location.split("/shop/");
    if (mParts.length < 2 || !mParts[1]) throw new Error("Shop ID not found in location");
    const shopID = mParts[1];

    // Registrazione e login cliente per ricavare clientToken valido
    await request(app)
        .post("/api/v1/register/client")
        .send({ username: "cliente", email: "cliente@qrtest.com", password: "Sicura!123#" });

    const cLogin = await request(app)
        .post("/api/v1/login")
        .send({ email: "cliente@qrtest.com", password: "Sicura!123#" });
    clientToken = cLogin.body.token;

    // Inserimento di prodotti con il mercante creato sopra
    await request(app)
        .post(`/api/v1/shops/${shopID}/products`)
        .set("Authorization", `Bearer ${merchantToken}`)
        .field("name", "Banana")
        .field("description", "desc")
        .field("origin", "Ecuador")
        .field("points", 10)
        .attach("image", Buffer.from("img"), "banana.jpg");

    // Trovo il productID per generare il QR
    const shopProducts = await request(app)
        .get(`/api/v1/shops/${shopID}/products`)
        .set("Authorization", `Bearer ${merchantToken}`);

    if (!shopProducts.body || shopProducts.body.length === 0) throw new Error("No products found");
    const productID = shopProducts.body[0].id;

    // Genero il codice QR per assegnare punti al cliente
    const qrResp = await request(app)
        .post("/api/v1/QRCodes/assignPoints")
        .set("Authorization", `Bearer ${merchantToken}`)
        .send([{ productID, quantity: 2 }]);

    const dataUrl: string = qrResp.text;
    if (!dataUrl.startsWith("data:image/")) throw new Error("Invalid QR Data URL");

    // Decodifico l'immagine del QR per estrarre il JWT token
    const base64 = dataUrl.split(",")[1];
    if (!base64) throw new Error("Failed to extract QR image data");

    const img = await Jimp.read(Buffer.from(base64, "base64"));
    const qrReader = new QrCode();

    qrToken = await new Promise<string>((resolve, reject) => {
        qrReader.callback = (err, value) => {
            if (err) reject(err);
            else resolve(value.result);
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

    it("6.1 Scansione codice QR già utilizzato", async () => {
        await request(app)
            .post("/api/v1/QRCodes/scanned")
            .set("Authorization", `Bearer ${clientToken}`)
            .send({ token: qrToken});

        const res = await request(app)
            .post("/api/v1/QRCodes/scanned")
            .set("Authorization", `Bearer ${clientToken}`)
            .send({ token: qrToken});

        expect(res.status).toBe(400);
    });

    it("6.2 Scansione QR da mercante invece che cliente", async () => {
        const res = await request(app)
            .post("/api/v1/QRCodes/scanned")
            .set("Authorization", `Bearer ${merchantToken}`)
            .send({ token: qrToken });

        expect(res.status).toBe(400);
    });

    it("6.3 Scansione token alternato", async () => {
        const res = await request(app)
            .post("/api/v1/QRCodes/scanned")
            .set("Authorization", `Bearer ${clientToken}`)
            .send({ token: qrToken + "abc" });

        expect(res.status).toBe(400);
    });
});
