import { describe, it, expect } from "@jest/globals";
import { ValidationService } from "../logic/validation";

describe("ValidationService", () => {
    it("should generate a proof for a job", async () => {
        const jobId = "job-123";
        const result = "Task Completed Successfully";

        const proof = await ValidationService.generateProof(jobId, result);

        expect(proof).toBeDefined();
        // MVP Stub: Hash of job + result
        expect(proof.length).toBeGreaterThan(0);
        expect(proof).toMatch(/^[a-f0-9]+$/); // Hex string
    });
});
