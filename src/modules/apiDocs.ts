import express from 'express';
import {readFileSync} from 'fs';
import swaggerUi from 'swagger-ui-express';
import yaml from "js-yaml";

const router = express.Router();
const swaggerDocument = yaml.load(readFileSync('oas3.yaml', 'utf8')) as swaggerUi.JsonObject;

router.use("/", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

export default router;