import request from "supertest";
import { app } from "../app";

// Mock the dependencies
jest.mock("../logic/products", () => ({
    fetchProducts: jest.fn().mockResolvedValue([
        {
            product_id: "EGLD-123-01",
            title: "Test NFT",
            description: "Desc",
            price: { amount: "0", currency: "EGLD" },
            custom_attributes: {
                token_id: "EGLD-123",
                nonce: 1
            }
        }
    ])
}));

jest.mock("../utils/environment", () => ({
    env: {
        MARKETPLACE_ADDRESS: "erd1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6gq4hu",
        API_URL: "http://mock-api",
        CHAIN_ID: "D",
        GAS_LIMIT: 60000000
    }
}));

describe("ACP Adapter Integration Tests", () => {

    describe("GET /.well-known/acp/products.json", () => {
        it("should return a list of products", async () => {
            const res = await request(app).get("/.well-known/acp/products.json");
            expect(res.status).toBe(200);
            expect(res.body.products).toBeInstanceOf(Array);
            expect(res.body.products[0]).toHaveProperty("title", "Test NFT");
        });
    });

    describe("POST /checkout", () => {
        it("should return requires_action for valid product using Config Address", async () => {
            const res = await request(app)
                .post("/checkout")
                .send({ product_id: "EGLD-123-01" });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe("requires_action");
            expect(res.body.next_action.dapp_url).toContain("receiver=erd1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6gq4hu");
        });

        it("should return 404 for invalid product", async () => {
            const res = await request(app)
                .post("/checkout")
                .send({ product_id: "INVALID-ID" });

            expect(res.status).toBe(404);
            expect(res.body.message).toContain("not found");
        });

        it("should return 400 for missing product_id", async () => {
            const res = await request(app)
                .post("/checkout")
                .send({});

            expect(res.status).toBe(400);
            expect(res.body.message).toBe("Missing product_id");
        });
    });
});
