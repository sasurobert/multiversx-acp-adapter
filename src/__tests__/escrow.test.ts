import { describe, it, expect } from "@jest/globals";

// Set valid test address before importing EscrowService (which reads env at import time)
process.env.ESCROW_CONTRACT_ADDRESS = "erd1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6gq4hu";

import { EscrowService } from "../logic/escrow";

const MOCK_RECEIVER = "erd1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6gq4hu";

describe("EscrowService", () => {
    it("should build a deposit transaction payload for ESDT", async () => {
        const payload = await EscrowService.buildDepositPayload({
            job_id: "job-123",
            token: "USDC-123456",
            token_nonce: 0,
            amount: "1000000",
            receiver: MOCK_RECEIVER,
            poa_hash: "agreement-hash-abc",
            deadline: Math.floor(Date.now() / 1000) + 86400,
        });

        expect(payload).toBeDefined();
        const decoded = Buffer.from(payload, "base64");
        expect(decoded.length).toBeGreaterThan(0);
    });

    it("should build a deposit transaction payload for EGLD", async () => {
        const payload = await EscrowService.buildDepositPayload({
            job_id: "job-456",
            token: "EGLD",
            token_nonce: 0,
            amount: "1000000000000000000",
            receiver: MOCK_RECEIVER,
            poa_hash: "agreement-hash-xyz",
            deadline: Math.floor(Date.now() / 1000) + 86400,
        });

        expect(payload).toBeDefined();
        const decoded = Buffer.from(payload, "base64");
        expect(decoded.length).toBeGreaterThan(0);
    });

    it("should build a release transaction", async () => {
        const tx = await EscrowService.buildReleaseTransaction(
            { job_id: "job-123" },
            MOCK_RECEIVER
        );

        expect(tx).toBeDefined();
        expect(tx.data).toBeDefined();
    });

    it("should build a refund transaction", async () => {
        const tx = await EscrowService.buildRefundTransaction(
            { job_id: "job-123" },
            MOCK_RECEIVER
        );

        expect(tx).toBeDefined();
        expect(tx.data).toBeDefined();
    });
});
