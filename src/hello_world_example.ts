import express from "express";

const router = express.Router();

router.get("/hello", (req, res) =>{
    res.send("GET: Hello world!");
});

router.post("/hello", (req, res) =>{
    res.send("POST: Hello world!");
});

export default router;