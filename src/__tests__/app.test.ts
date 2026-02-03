import request from "supertest";
import { app } from "../app";
import { Mnemonic } from "@multiversx/sdk-wallet";
import { env } from "../utils/environment";

jest.mock("../utils/environment", () => ({
    env: {
        VENDOR_ADDRESS: "erd1h3wp7ecggy3yyvwppehr0pa3htssd887dkykxgvwxyh9paz7gacsfcm0rt",
        ESCROW_ADDRESS: "erd1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6gq4hu",
        MARKETPLACE_ADDRESS: "erd1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6gq4hu",
        CHAIN_ID: "D",
        GAS_LIMIT: 60000000,
        VENDOR_SECRET_KEY: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
    }
}));

describe("App Integration Tests", () => {

    beforeAll(() => {
        // process.env values are less important now that we mock env, 
        // but we keep them for any other direct access.
        process.env.VENDOR_SECRET_KEY = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
        process.env.TEST_MODE = "true";
    });

    it("POST /negotiate should return a signed proposal", async () => {
        const rfpPayload = {
            rfp_id: "rfp-integration-test",
            client_id: "erd1client...",
            task_description: "Integration Test Task",
            budget_limit: "1000000",
            token_identifier: "USDC-c76f1f",
            deadline_block: 5000
        };

        const response = await request(app)
            .post("/negotiate")
            .send(rfpPayload)
            .expect(200);

        expect(response.body.status).toBe("accepted");
        expect(response.body.proposal).toBeDefined();
    });

    it("POST /checkout should return deposit tx for Escrow Job (Full Flow)", async () => {
        // 1. Negotiate
        const rfpPayload = {
            rfp_id: "rfp-flow-test",
            client_id: "erd1client...",
            task_description: "Flow Test",
            budget_limit: "5000",
            token_identifier: "EGLD",
            deadline_block: 6000
        };

        const negRes = await request(app)
            .post("/negotiate")
            .send(rfpPayload)
            .expect(200);

        const jobId = negRes.body.proposal.job_id;

        // 2. Checkout
        const res = await request(app)
            .post("/checkout")
            .send({
                job_id: jobId,
                type: "escrow"
            });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe("requires_action");
        // Expect deposit@...
        expect(res.body.next_action.data).toMatch(/^deposit@/);
        expect(res.body.next_action.receiver).toBeDefined();
    });

    it("POST /checkout should return 404 for invalid job_id", async () => {
        const res = await request(app)
            .post("/checkout")
            .send({ job_id: "invalid-job-id", type: "escrow" });

        expect(res.status).toBe(404);
    });
});
