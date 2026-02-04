import request from "supertest";
import express from "express";
import { idempotencyMiddleware, IdempotencyStore } from "../../middleware/idempotency";

describe("Idempotency Middleware", () => {
    let app: express.Express;

    beforeEach(() => {
        IdempotencyStore.clear();
        app = express();
        app.use(express.json());
        app.use(idempotencyMiddleware);
        app.post("/test", (req, res) => {
            res.status(201).json({ id: `response_${Date.now()}`, data: req.body });
        });
    });

    it("should process request normally without idempotency key", async () => {
        const res = await request(app)
            .post("/test")
            .send({ test: "data" });
        expect(res.status).toBe(201);
    });

    it("should return cached response for duplicate idempotency key", async () => {
        const idempotencyKey = "test_key_123";

        const res1 = await request(app)
            .post("/test")
            .set("Idempotency-Key", idempotencyKey)
            .send({ test: "data" });

        const res2 = await request(app)
            .post("/test")
            .set("Idempotency-Key", idempotencyKey)
            .send({ test: "data" });

        expect(res1.body.id).toBe(res2.body.id);
        expect(res1.status).toBe(res2.status);
    });

    it("should return 409 for same key with different params", async () => {
        const idempotencyKey = "conflict_key_456";

        await request(app)
            .post("/test")
            .set("Idempotency-Key", idempotencyKey)
            .send({ test: "data1" });

        const res2 = await request(app)
            .post("/test")
            .set("Idempotency-Key", idempotencyKey)
            .send({ test: "different_data" });

        expect(res2.status).toBe(409);
        expect(res2.body.code).toBe("idempotency_conflict");
    });

    it("should echo Idempotency-Key in response headers", async () => {
        const idempotencyKey = "echo_key_789";

        const res = await request(app)
            .post("/test")
            .set("Idempotency-Key", idempotencyKey)
            .send({ test: "data" });

        expect(res.headers["idempotency-key"]).toBe(idempotencyKey);
    });
});
