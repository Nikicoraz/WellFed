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
    // Register merchant
    await request(app)
        .post("/api/v1/register/merchant")
        .field("name", "Negozio Test")
        .field("email", "merchant@qrtest.com")
        .field("password", "Sicura!123#")
        .field("address", "Via Test")
        .field("partitaIVA", "IT12345678901")
        .attach("image", Buffer.from("img"), "shop.jpg");

    // Merchant login
    const mLogin = await request(app)
        .post("/api/v1/login")
        .send({ email: "merchant@qrtest.com", password: "Sicura!123#" });

    merchantToken = mLogin.body.token;
    const location = mLogin.headers.location;
    if (!location) throw new Error("Location header missing");
    const mParts = location.split("/shop/");
    if (mParts.length < 2 || !mParts[1]) throw new Error("Shop ID not found in location");
    shopID = mParts[1];

    // Register client
    await request(app)
        .post("/api/v1/register/client")
        .send({ username: "cliente", email: "cliente@qrtest.com", password: "Sicura!123#" });

    // Client login
    const cLogin = await request(app)
        .post("/api/v1/login")
        .send({ email: "cliente@qrtest.com", password: "Sicura!123#" });
    clientToken = cLogin.body.token;

    // Add a product
    await request(app)
        .post(`/api/v1/shops/${shopID}/products`)
        .set("Authorization", `Bearer ${merchantToken}`)
        .field("name", "Banana")
        .field("description", "desc")
        .field("origin", "Ecuador")
        .field("points", 10)
        .attach("image", Buffer.from("img"), "banana.jpg");

    // Fetch product list from shop
    const shopProducts = await request(app)
        .get(`/api/v1/shops/${shopID}/products`)
        .set("Authorization", `Bearer ${merchantToken}`);

    if (!shopProducts.body || shopProducts.body.length === 0) throw new Error("No products found");
    productID = shopProducts.body[0].id;

    // Generate QR via assignPoints API
    const qrResp = await request(app)
        .post("/api/v1/QRCodes/assignPoints")
        .set("Authorization", `Bearer ${merchantToken}`)
        .send([{ productID, quantity: 2 }]);

    const dataUrl: string = qrResp.text;
    if (!dataUrl.startsWith("data:image/")) throw new Error("Invalid QR Data URL");

    // Decode the QR image to extract the JWT token
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
