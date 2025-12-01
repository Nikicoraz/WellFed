import type { AuthenticatedRequest } from "./middleware/tokenChecker.js";
import express from "express";

const router = express.Router();

router.get("/hello", (req, res) =>{
    const user = (req as AuthenticatedRequest).user.username;
    res.send(`GET: Hello ${user}!`);
});

router.post("/hello", (req, res) =>{
    const user = (req as AuthenticatedRequest).user.username;
    res.send(`POST: Hello ${user}!`);
});

export default router;