import { describe, it, expect, beforeAll } from "@jest/globals";
import request from "supertest";
import { app } from "../app";
import crypto from "crypto";

jest.mock("../logic/products", () => ({
    getProductById: jest.fn().mockImplementation(async (id: string) => {
        return {
            product_id: id,
            title: `Mock Product ${id}`,
            description: "Mock Description",
            price: { amount: "1000", currency: "USD" }, // 10.00 USD
            custom_attributes: { token_id: "TKN-123", nonce: 1 }
        };
    }),
    parsePrice: jest.fn().mockReturnValue(1000)
}));

describe("ACP Compliance Integration", () => {
    const API_KEY = "test_api_key_123";
    const SIGNING_SECRET = "test_signing_secret_456";

    beforeAll(() => {
        process.env.ACP_API_KEY = API_KEY;
        process.env.ACP_SIGNING_SECRET = SIGNING_SECRET;
        process.env.ORDER_PERMALINK_BASE_URL = "https://test.com/orders";
    });

    function getAuthHeaders(body: Record<string, unknown> = {}) {
        const timestamp = new Date().toISOString();
        const bodyStr = JSON.stringify(body);
        const signature = crypto
            .createHmac("sha256", SIGNING_SECRET)
            .update(`${timestamp}.${bodyStr}`)
            .digest("base64");

        return {
            "Authorization": `Bearer ${API_KEY}`,
            "Signature": signature,
            "Timestamp": timestamp,
            "Accept-Language": "en-US",
            "Request-Id": `req_${Math.random().toString(36).substring(7)}`
        };
    }

    describe("Security Middleware", () => {
        it("should reject request with missing auth", async () => {
            const res = await request(app).post("/checkout_sessions").send({});
            expect(res.status).toBe(401);
        });

        it("should reject request with invalid signature", async () => {
            const res = await request(app)
                .post("/checkout_sessions")
                .set("Authorization", `Bearer ${API_KEY}`)
                .set("Signature", "wrong")
                .set("Timestamp", new Date().toISOString())
                .send({});
            expect(res.status).toBe(401);
        });
    });

    describe("Full Checkout Flow", () => {
        let sessionId: string;

        it("1. Create Session (minimal params)", async () => {
            const body = {
                items: [{ product_id: "nft-1", quantity: 1, price: 1000 }]
            };
            const res = await request(app)
                .post("/checkout_sessions")
                .set(getAuthHeaders(body))
                .send(body);

            expect(res.status).toBe(201);
            expect(res.body.status).toBe("not_ready_for_payment");
            expect(res.body.fulfillment_options).toBeDefined();
            expect(res.body.messages.some((m: { param?: string }) => m.param === "$.fulfillment_address")).toBe(true);
            sessionId = res.body.id;
        });

        it("2. Update Session (add address)", async () => {
            const body = {
                fulfillment_address: {
                    name: "John Doe",
                    line_one: "123 Main St",
                    city: "New York",
                    state: "NY",
                    country: "US",
                    postal_code: "10001"
                }
            };
            const res = await request(app)
                .post(`/checkout_sessions/${sessionId}`)
                .set(getAuthHeaders(body))
                .send(body);

            expect(res.status).toBe(201);
            expect(res.body.status).toBe("ready_for_payment");
            expect(res.body.fulfillment_options.length).toBeGreaterThan(1); // Should include shipping now
        });

        it("3. Complete Session", async () => {
            const body = {
                buyer: { email: "john@example.com", name: "John Doe" },
                payment_data: { token: "tok_123", provider: "multiversx" }
            };
            const res = await request(app)
                .post(`/checkout_sessions/${sessionId}/complete`)
                .set(getAuthHeaders(body))
                .send(body);

            expect(res.status).toBe(201);
            expect(res.body.status).toBe("completed");
            expect(res.body.order).toBeDefined();
            expect(res.body.order.permalink_url).toContain("orders/order_");
        });

        it("4. Idempotency Check (Duplicate Complete)", async () => {
            const body = {
                buyer: { email: "john@example.com", name: "John Doe" },
                payment_data: { token: "tok_123", provider: "multiversx" }
            };
            const headers = getAuthHeaders(body) as Record<string, string>;
            headers["Idempotency-Key"] = "idem_key_complete_123";

            const res1 = await request(app)
                .post(`/checkout_sessions/${sessionId}/complete`)
                .set(headers)
                .send(body);

            const res2 = await request(app)
                .post(`/checkout_sessions/${sessionId}/complete`)
                .set(headers)
                .send(body);

            expect(res1.body.id).toBe(res2.body.id);
            expect(res1.headers["idempotency-key"]).toBe("idem_key_complete_123");
        });
    });
});
