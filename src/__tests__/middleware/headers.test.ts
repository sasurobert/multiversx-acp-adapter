import { describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";
import express from "express";
import { headersMiddleware } from "../../middleware/headers";

describe("Headers Middleware", () => {
    let app: express.Application;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use(headersMiddleware);
        app.post("/test", (req: express.Request, res: express.Response) => {
            res.status(200).json({
                locale: (req as unknown as { locale: string }).locale,
                requestId: (req as unknown as { requestId: string }).requestId,
                apiVersion: (req as unknown as { apiVersion: string }).apiVersion
            });
        });
    });

    it("should echo Request-Id in response", async () => {
        const res = await request(app)
            .post("/test")
            .set("Request-Id", "req_abc123")
            .send({});

        expect(res.headers["request-id"]).toBe("req_abc123");
        expect(res.body.requestId).toBe("req_abc123");
    });

    it("should parse Accept-Language header", async () => {
        const res = await request(app)
            .post("/test")
            .set("Accept-Language", "es-ES")
            .send({});

        expect(res.body.locale).toBe("es-ES");
    });

    it("should validate API-Version header when provided", async () => {
        const res = await request(app)
            .post("/test")
            .set("API-Version", "2025-09-12")
            .send({});

        expect(res.status).toBe(200);
        expect(res.body.apiVersion).toBe("2025-09-12");
    });

    it("should default locale to en-US", async () => {
        const res = await request(app)
            .post("/test")
            .send({});

        expect(res.body.locale).toBe("en-US");
    });
});
