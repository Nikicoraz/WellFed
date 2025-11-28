import "dotenv/config";
import cors from 'cors';
import express from "express";
import helloExample from "./hello_world_example.js";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors());
app.use(helloExample);

export default app;