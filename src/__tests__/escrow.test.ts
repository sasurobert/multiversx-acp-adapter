import { EscrowService } from "../logic/escrow";

describe("EscrowService", () => {
    it("should build a deposit transaction payload for ESDT", () => {
        const jobId = "job-123";
        const poaHash = "abcdef123456";
        const token = "USDC-123456";
        const amount = "1000000";
        const vendorAddress = "erd1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6gq4hu";

        const payload = EscrowService.buildDepositPayload({
            job_id: jobId,
            token: token,
            amount: amount,
            poa_hash: poaHash,
            vendor: vendorAddress
        });

        const expectedJobHex = Buffer.from(jobId).toString("hex");
        const expectedTokenHex = Buffer.from(token).toString("hex");

        expect(payload).toContain("ESDTTransfer");
        expect(payload).toContain(expectedTokenHex);
        expect(payload).toContain("6465706f736974"); // 'deposit' in hex
        expect(payload).toContain(expectedJobHex);
    });

    it("should build a deposit transaction payload for EGLD", () => {
        const jobId = "job-123";
        const poaHash = "abcdef123456";
        const token = "EGLD";
        const amount = "1000000";
        const vendorAddress = "erd1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6gq4hu";

        const payload = EscrowService.buildDepositPayload({
            job_id: jobId,
            token: token,
            amount: amount,
            poa_hash: poaHash,
            vendor: vendorAddress
        });

        // EGLD transfer calls function directly
        // deposit@job_id@vendor@poa
        expect(payload).not.toContain("ESDTTransfer");
        expect(payload).toMatch(/^deposit@/);
    });
});
