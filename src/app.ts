import cors from 'cors';
import express from "express";
import helloExample from "./hello_world_example.js";
import registration from "./modules/registration.js";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.use(helloExample);
app.use("/api/v1/register/", registration);

export default app;