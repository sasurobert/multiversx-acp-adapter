import request from "supertest";
import { app } from "../app";

describe("ACP Adapter Integration Tests", () => {

    describe("GET /.well-known/acp/products.json", () => {
        it("should return a list of products", async () => {
            const res = await request(app).get("/.well-known/acp/products.json");
            expect(res.status).toBe(200);
            expect(res.body.products).toBeInstanceOf(Array);
            expect(res.body.products.length).toBeGreaterThan(0);
            expect(res.body.products[0]).toHaveProperty("title", "Test NFT");
        });
    });

    describe("POST /checkout", () => {
        it("should return requires_action for valid product", async () => {
            const res = await request(app)
                .post("/checkout")
                .send({ product_id: "EGLD-123-01" });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe("requires_action");
            expect(res.body.next_action.type).toBe("use_dapp_wallet");
            expect(res.body.next_action.dapp_url).toContain("buy@");
        });

        it("should return 404 for invalid product", async () => {
            const res = await request(app)
                .post("/checkout")
                .send({ product_id: "INVALID-ID" });

            expect(res.status).toBe(404);
            expect(res.body.error).toBe("Product not found");
        });

        it("should return 400 for missing product_id", async () => {
            const res = await request(app)
                .post("/checkout")
                .send({});

            expect(res.status).toBe(400);
            expect(res.body.error).toBe("Missing product_id");
        });
    });
});
