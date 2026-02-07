import { describe, it, expect } from "@jest/globals";
import { EscrowService } from "../logic/escrow";

describe("EscrowService", () => {
    it("should build a deposit transaction payload for ESDT", async () => {
        const jobId = "job-123";
        const token = "USDC-123456";
        const amount = "1000000";
        const agentNonce = 1;
        const serviceId = "chat";
        const validatorAddress = "erd1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6gq4hu";

        const payload = await EscrowService.buildDepositPayload({
            job_id: jobId,
            token: token,
            token_nonce: 0,
            amount: amount,
            agent_nonce: agentNonce,
            service_id: serviceId,
            validator_address: validatorAddress
        });

        expect(payload).toBeDefined();
        // The payload is now base64 encoded because buildDepositPayload uses Buffer.from(tx.data).toString("base64")
        const decoded = Buffer.from(payload, "base64");
        expect(decoded.length).toBeGreaterThan(0);
    });

    it("should build a deposit transaction payload for EGLD", async () => {
        const jobId = "job-123";
        const token = "EGLD";
        const amount = "1000000";
        const agentNonce = 1;
        const serviceId = "chat";
        const validatorAddress = "erd1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6gq4hu";

        const payload = await EscrowService.buildDepositPayload({
            job_id: jobId,
            token: token,
            token_nonce: 0,
            amount: amount,
            agent_nonce: agentNonce,
            service_id: serviceId,
            validator_address: validatorAddress
        });

        expect(payload).toBeDefined();
        const decoded = Buffer.from(payload, "base64");
        expect(decoded.length).toBeGreaterThan(0);
    });
});
