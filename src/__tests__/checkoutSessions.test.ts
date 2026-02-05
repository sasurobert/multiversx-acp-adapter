import { describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";
import { app } from "../app";
import { StorageService } from "../logic/storage";

import { getProductById, AcpProduct } from "../logic/products";

jest.mock("../logic/products");
const mockGetProductById = getProductById as jest.MockedFunction<typeof getProductById>;

describe("Checkout Sessions API", () => {
    beforeEach(() => {
        // Clear storage before each test
        StorageService.sessions = {};

        // Setup default mock response
        mockGetProductById.mockImplementation(async (id: string) => {
            if (id === "product_123") {
                return {
                    product_id: "product_123",
                    title: "Product 123",
                    description: "Description",
                    price: { amount: "10.00", currency: "USD" },
                    custom_attributes: { token_id: "123", nonce: 1 },
                } as AcpProduct;
            }
            if (id === "product_456") {
                return {
                    product_id: "product_456",
                    title: "Product 456",
                    description: "Description",
                    price: { amount: "20.00", currency: "USD" },
                    custom_attributes: { token_id: "456", nonce: 1 },
                } as AcpProduct;
            }
            return null;
        });
    });

    describe("POST /checkout_sessions", () => {
        it("should create a checkout session with items", async () => {
            const response = await request(app)
                .post("/checkout_sessions")
                .send({
                    items: [
                        { id: "product_123", quantity: 1 },
                        { id: "product_456", quantity: 2 },
                    ],
                })
                .expect(201);

            expect(response.body.id).toMatch(/^checkout_session_/);
            expect(response.body.status).toBe("not_ready_for_payment");
            expect(response.body.line_items).toHaveLength(2);
            expect(response.body.currency).toBe("usd");
            expect(response.body.payment_provider.provider).toBe("multiversx");
        });

        it("should create session with ready_for_payment status when fulfillment address provided", async () => {
            const response = await request(app)
                .post("/checkout_sessions")
                .send({
                    items: [{ id: "product_123", quantity: 1 }],
                    fulfillment_address: {
                        name: "John Doe",
                        line_one: "123 Main St",
                        city: "San Francisco",
                        state: "CA",
                        country: "US",
                        postal_code: "94102",
                    },
                })
                .expect(201);

            expect(response.body.status).toBe("ready_for_payment");
            expect(response.body.fulfillment_address).toBeDefined();
        });

        it("should return 400 if items are missing", async () => {
            const response = await request(app)
                .post("/checkout_sessions")
                .send({})
                .expect(400);

            expect(response.body.code).toBe("invalid_request");
        });

        it("should return 500 if product is not found", async () => {
            const response = await request(app)
                .post("/checkout_sessions")
                .send({
                    items: [{ id: "invalid_product_id", quantity: 1 }]
                })
                .expect(500);

            expect(response.body.code).toBe("processing_error");
            expect(response.body.message).toContain("Product not found");
        });
    });

    describe("POST /checkout_sessions/:id", () => {
        it("should update an existing checkout session", async () => {
            // Create session first
            const createResponse = await request(app)
                .post("/checkout_sessions")
                .send({
                    items: [{ id: "product_123", quantity: 1 }],
                });

            const sessionId = createResponse.body.id;

            // Update session
            const updateResponse = await request(app)
                .post(`/checkout_sessions/${sessionId}`)
                .send({
                    fulfillment_address: {
                        name: "Jane Doe",
                        line_one: "456 Oak Ave",
                        city: "Los Angeles",
                        state: "CA",
                        country: "US",
                        postal_code: "90001",
                    },
                })
                .expect(201);

            expect(updateResponse.body.status).toBe("ready_for_payment");
            expect(updateResponse.body.fulfillment_address.name).toBe("Jane Doe");
        });

        it("should return 404 for non-existent session", async () => {
            const response = await request(app)
                .post("/checkout_sessions/invalid_session_id")
                .send({
                    items: [{ id: "product_123", quantity: 1 }],
                })
                .expect(404);

            expect(response.body.code).toBe("invalid_request");
        });
    });

    describe("GET /checkout_sessions/:id", () => {
        it("should retrieve an existing checkout session", async () => {
            // Create session
            const createResponse = await request(app)
                .post("/checkout_sessions")
                .send({
                    items: [{ id: "product_123", quantity: 1 }],
                });

            const sessionId = createResponse.body.id;

            // Retrieve session
            const getResponse = await request(app)
                .get(`/checkout_sessions/${sessionId}`)
                .expect(200);

            expect(getResponse.body.id).toBe(sessionId);
            expect(getResponse.body.line_items).toHaveLength(1);
        });

        it("should return 404 for non-existent session", async () => {
            const response = await request(app)
                .get("/checkout_sessions/invalid_session_id")
                .expect(404);

            expect(response.body.code).toBe("invalid_request");
        });
    });

    describe("POST /checkout_sessions/:id/complete", () => {
        it("should complete a checkout session and create an order", async () => {
            // Create session with fulfillment address
            const createResponse = await request(app)
                .post("/checkout_sessions")
                .send({
                    items: [{ id: "product_123", quantity: 1 }],
                    fulfillment_address: {
                        name: "John Doe",
                        line_one: "123 Main St",
                        city: "San Francisco",
                        state: "CA",
                        country: "US",
                        postal_code: "94102",
                    },
                });

            const sessionId = createResponse.body.id;

            // Complete session
            const completeResponse = await request(app)
                .post(`/checkout_sessions/${sessionId}/complete`)
                .send({
                    buyer: {
                        name: "John Doe",
                        email: "john@example.com",
                        phone_number: "+15551234567",
                    },
                    payment_data: {
                        token: "payment_token_123",
                        provider: "multiversx",
                    },
                })
                .expect(201);

            expect(completeResponse.body.status).toBe("completed");
            expect(completeResponse.body.order_id).toMatch(/^order_/);
            expect(completeResponse.body.buyer.email).toBe("john@example.com");
        });

        it("should return 400 if buyer or payment_data is missing", async () => {
            const createResponse = await request(app)
                .post("/checkout_sessions")
                .send({
                    items: [{ id: "product_123", quantity: 1 }],
                });

            const sessionId = createResponse.body.id;

            const response = await request(app)
                .post(`/checkout_sessions/${sessionId}/complete`)
                .send({})
                .expect(400);

            expect(response.body.code).toBe("invalid_request");
        });

        it("should return 400 if session is already completed", async () => {
            const createResponse = await request(app)
                .post("/checkout_sessions")
                .send({
                    items: [{ id: "product_123", quantity: 1 }],
                    fulfillment_address: {
                        name: "John Doe",
                        line_one: "123 Main St",
                        city: "San Francisco",
                        state: "CA",
                        country: "US",
                        postal_code: "94102",
                    },
                });

            const sessionId = createResponse.body.id;

            // Complete once
            await request(app)
                .post(`/checkout_sessions/${sessionId}/complete`)
                .send({
                    buyer: {
                        name: "John Doe",
                        email: "john@example.com",
                    },
                    payment_data: {
                        token: "payment_token_123",
                        provider: "multiversx",
                    },
                });

            // Try to complete again
            const response = await request(app)
                .post(`/checkout_sessions/${sessionId}/complete`)
                .send({
                    buyer: {
                        name: "John Doe",
                        email: "john@example.com",
                    },
                    payment_data: {
                        token: "payment_token_123",
                        provider: "multiversx",
                    },
                })
                .expect(400);

            expect(response.body.code).toBe("invalid_request");
        });
    });

    describe("POST /checkout_sessions/:id/cancel", () => {
        it("should cancel a checkout session", async () => {
            // Create session
            const createResponse = await request(app)
                .post("/checkout_sessions")
                .send({
                    items: [{ id: "product_123", quantity: 1 }],
                });

            const sessionId = createResponse.body.id;

            // Cancel session
            const cancelResponse = await request(app)
                .post(`/checkout_sessions/${sessionId}/cancel`)
                .expect(200);

            expect(cancelResponse.body.status).toBe("canceled");
        });

        it("should return 405 if trying to cancel a completed session", async () => {
            const createResponse = await request(app)
                .post("/checkout_sessions")
                .send({
                    items: [{ id: "product_123", quantity: 1 }],
                    fulfillment_address: {
                        name: "John Doe",
                        line_one: "123 Main St",
                        city: "San Francisco",
                        state: "CA",
                        country: "US",
                        postal_code: "94102",
                    },
                });

            const sessionId = createResponse.body.id;

            // Complete session
            await request(app)
                .post(`/checkout_sessions/${sessionId}/complete`)
                .send({
                    buyer: {
                        name: "John Doe",
                        email: "john@example.com",
                    },
                    payment_data: {
                        token: "payment_token_123",
                        provider: "multiversx",
                    },
                });

            // Try to cancel
            const response = await request(app)
                .post(`/checkout_sessions/${sessionId}/cancel`)
                .expect(405);

            expect(response.body.code).toBe("invalid_request");
        });

        it("should return 404 for non-existent session", async () => {
            const response = await request(app)
                .post("/checkout_sessions/invalid_session_id/cancel")
                .expect(404);

            expect(response.body.type).toBe("invalid_request");
            expect(response.body.code).toBe("invalid_request");
        });
    });
});
