import { describe, it, expect, beforeAll } from "@jest/globals";
import { StorageService } from "../logic/storage";

describe("Storage Persistence Tests", () => {


    beforeAll(() => {
        // Clear any existing test data if needed, or just let it run
        StorageService.init();
    });

    it("should persist and reload jobs across sessions", () => {
        const testJobId = "persistence-test-job-" + Date.now();
        const testData = {
            id: testJobId,
            status: "TESTING",
            rfp: { rfp_id: "rfp1", client_id: "c1", task_description: "t1", budget_limit: "100", token_identifier: "EGLD", deadline_block: 100 },
            proposal: { job_id: testJobId, price: "100", token: "EGLD", deadline_block: 100, vendor_signature: "sig1" }
        };

        // 1. Set Job
        StorageService.setJob(testJobId, testData);

        // Verify it exists in memory
        expect(StorageService.jobs[testJobId]).toEqual(testData);

        // 2. Clear memory and re-init (Simulate restart)
        StorageService.jobs = {};
        expect(StorageService.jobs[testJobId]).toBeUndefined();

        StorageService.init();

        // 3. Verify it was reloaded from disk
        expect(StorageService.jobs[testJobId]).toEqual(testData);

        // Cleanup
        delete StorageService.jobs[testJobId];
        StorageService.save();
    });

    it("should persist and reload payments across sessions", () => {
        const testToken = "persistence-test-token-" + Date.now();
        const testPayload = {
            token: testToken,
            status: "pending",
            payload: { sender: "erd1...", receiver: "erd2...", nonce: 1, value: "0", data: "...", signature: "sig" }
        };

        // 1. Set Payment
        StorageService.setPayment(testToken, testPayload);

        // 2. Clear and Reload
        StorageService.payments = {};
        StorageService.init();

        // 3. Verify
        expect(StorageService.payments[testToken]).toEqual(testPayload);

        // Cleanup
        delete StorageService.payments[testToken];
        StorageService.save();
    });
});
