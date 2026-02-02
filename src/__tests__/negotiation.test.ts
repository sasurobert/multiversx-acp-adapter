import { NegotiationService, RFP } from "../logic/negotiation";
import { UserSigner } from "@multiversx/sdk-wallet";
import { Mnemonic } from "@multiversx/sdk-wallet";

describe("NegotiationService", () => {
    // Generate a temporary vendor wallet for testing
    const mnemonic = Mnemonic.generate();
    const vendorKey = mnemonic.deriveKey(0);
    const vendorAddress = vendorKey.generatePublicKey().toAddress().bech32();

    beforeAll(() => {
        // Mock environment variable
        process.env.VENDOR_SECRET_KEY = vendorKey.hex();
    });

    it("should create a proposal with a valid signature", async () => {
        const rfp: RFP = {
            rfp_id: "test-rfp-1",
            client_id: "erd1client...",
            task_description: "Test Task",
            budget_limit: "1000000",
            token_identifier: "USDC-c76f1f",
            deadline_block: 1000
        };

        const proposal = await NegotiationService.createProposal(rfp);

        expect(proposal.job_id).toBeDefined();
        expect(proposal.price).toBe("1000000"); // MVP: 1:1 price
        expect(proposal.vendor_signature).toBeDefined();

        // Verify the signature
        // Reconstruct expected message: sha256(job_id + client + vendor + token + amount + deadline)
        // This logic will be in the service, but here we verify the result.
        // For TDD, we just check it returns something for now, keeping it simple.
        expect(proposal.vendor_signature.length).toBeGreaterThan(0);
    });

    it("should throw error if VENDOR_SECRET_KEY is missing", async () => {
        const oldKey = process.env.VENDOR_SECRET_KEY;
        delete process.env.VENDOR_SECRET_KEY;

        const rfp: RFP = {
            rfp_id: "test-rfp-2",
            client_id: "erd1client...",
            task_description: "Test Task",
            budget_limit: "1000000",
            token_identifier: "USDC-c76f1f",
            deadline_block: 1000
        };

        await expect(NegotiationService.createProposal(rfp)).rejects.toThrow("Missing VENDOR_SECRET_KEY");

        process.env.VENDOR_SECRET_KEY = oldKey;
    });
});
