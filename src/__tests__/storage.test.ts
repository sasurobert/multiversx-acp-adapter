import fs from "fs";
import path from "path";
import { StorageService } from "../logic/storage";

describe("Storage Persistence Tests", () => {
    const dataDir = path.join(process.cwd(), "data");

    beforeAll(() => {
        // Clear any existing test data if needed, or just let it run
        StorageService.init();
    });

    it("should persist and reload jobs across sessions", () => {
        const testJobId = "persistence-test-job-" + Date.now();
        const testData = { status: "TESTING", value: "some-data" };

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
        const testPayload = { sender: "erd1...", signature: "sig" };

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
