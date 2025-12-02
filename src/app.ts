import cors from 'cors';
import express from "express";
import helloExample from "./hello_world_example.js";
import login from "./modules/login.js";
import qrcode from "./modules/qrcode.js";
import registration from "./modules/registration.js";
import tokenChecker from './middleware/tokenChecker.js';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Hello example is protected by authentication
app.use("/api/v1/register/", registration);
app.use("/api/v1/login/", login);

// all protected API from here
app.use(tokenChecker);

app.use("/api/v1/QRCodes/", qrcode);
app.use(helloExample);

export default app;