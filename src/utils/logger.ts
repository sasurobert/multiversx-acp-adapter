import pino from "pino";

const isDevelopment = process.env.NODE_ENV !== "production" || process.env.TEST_MODE === "true";

export const logger = pino({
    level: process.env.LOG_LEVEL || "info",
    transport: isDevelopment
        ? {
            target: "pino-pretty",
            options: {
                colorize: true,
            },
        }
        : undefined,
});
