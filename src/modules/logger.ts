import pino from "pino";

export const logger = pino({
    level: process.env.LOG_LEVEL ?? "info" // set to "debug" to have all logs printed
});

