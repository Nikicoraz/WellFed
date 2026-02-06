import Client from "../models/client.js";
import Notification from "../models/notification.js";
import app from "../app.js";
import request from "supertest";
import { sendNotification } from "../modules/notifications.js";

let clientToken: string;
let clientID: string;

beforeAll(async () => {
    // Registrazione cliente
    let res = await request(app)
        .post("/api/v1/register/client")
        .send({
            username: "client",
            email: "cliente@test.com",
            password: "Sicura!123#"
        });
    expect(res.status).toBe(201);

    // Login cliente
    res = await request(app)
        .post("/api/v1/login")
        .send({ email: "cliente@test.com", password: "Sicura!123#" });
    expect(res.status).toBe(200);
    
    clientToken = res.body.token;

    res = await request(app)
        .get("/api/v1/client")
        .set("Authorization", `Bearer ${clientToken}`);
    expect(res.status).toBe(200);

    clientID = res.body.id;
});

describe("Notifications Controller", () => {

    it("10.0 Creazione notifica e associazione al client", async () => {
        await sendNotification("/shop/test", "Titolo Test", "Messaggio Test", clientID as never);

        const client = await Client.findById(clientID);
        expect(client!.notifications.length).toBeGreaterThanOrEqual(1);

        const notif = await Notification.findOne({ title: "Titolo Test" });
        expect(notif).not.toBeNull();
    });

    it("10.1 Recupero notifiche del client autenticato", async () => {
        const res = await request(app)
            .get("/api/v1/notifications")
            .set("Authorization", `Bearer ${clientToken}`);

        expect(res.status).toBe(200);
        expect(res.body.length).toBeGreaterThanOrEqual(1);
        expect(res.body[1]).toHaveProperty("title", "Titolo Test");
        expect(res.body[1]).toHaveProperty("viewed", false);
    });

    it("10.2 Segnare una notifica come visualizzata", async () => {
        const client = await Client.findById(clientID);
        const notificationID = client!.notifications[0]!.notification.toString();

        const res = await request(app)
            .patch(`/api/v1/notifications/${notificationID}`)
            .set("Authorization", `Bearer ${clientToken}`);

        expect(res.status).toBe(200);

        const updated = await Client.findById(clientID);
        expect(updated!.notifications[0]!.viewed).toBe(true);
    });

    it("10.3 Tentativo di visualizzazione notifica non appartenente al client", async () => {
        const fakeID = "507f1f77bcf86cd799439011";

        const res = await request(app)
            .patch(`/api/v1/notifications/${fakeID}`)
            .set("Authorization", `Bearer ${clientToken}`);

        expect(res.status).toBe(404);
    });

    it("10.4 Eliminazione notifica dalla lista del client", async () => {
        await sendNotification("/shop/test2", "Delete Me", "Bye :(", clientID as never);

        const client = await Client.findById(clientID);
        const notificationID = client!.notifications.find(n => {
            return n.viewed === false;
        })!.notification.toString();

        const res = await request(app)
            .delete(`/api/v1/notifications/${notificationID}`)
            .set("Authorization", `Bearer ${clientToken}`);
        expect(res.status).toBe(200);

        const updated = await Client.findById(clientID);
        const exists = updated!.notifications.some(n => {
            return n.notification.toString() === notificationID;
        });
        expect(exists).toBe(false);
    });
});
