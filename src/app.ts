import client from './modules/client.js';
import cors from 'cors';
import express from "express";
import helloExample from "./hello_world_example.js";
import login from "./modules/login.js";
import notifications from './modules/notifications.js';
import qrcode from "./modules/qrcode.js";
import registration from "./modules/registration.js";
import shops from "./modules/shops.js";
import shopsAuth from "./modules/shopsAuth.js";
import tokenChecker from './middleware/tokenChecker.js';
import transactions from './modules/transactions.js';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Hello example is protected by authentication
app.use("/api/v1/register/", registration);
app.use("/api/v1/login/", login);
app.use("/api/v1/shops/", shops);

// all protected API from here
app.use(tokenChecker);

app.use("/api/v1/client/", client);
app.use("/api/v1/shops/", shopsAuth);
app.use("/api/v1/QRCodes/", qrcode);
app.use("/api/v1/notifications/", notifications);
app.use("/api/v1/transactions/", transactions);
app.use(helloExample);

export default app;