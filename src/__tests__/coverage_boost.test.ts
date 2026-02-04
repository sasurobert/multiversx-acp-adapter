import { describe, it, expect, jest } from "@jest/globals";
import { fetchAcpProducts } from "../logic/products";
import { RelayerService } from "../logic/relayer";
import axios from "axios";
import { env } from "../utils/environment";

jest.mock("axios");

// Manual mock for logger
jest.mock("../utils/logger", () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    }
}));

describe("Coverage Boost", () => {

    describe("Products Logic", () => {
        it("should handle error when fetching products fails", async () => {
            (axios.get as any).mockRejectedValue(new Error("Network Error"));
            const products = await fetchAcpProducts();
            expect(products).toEqual([]);
        });

        it("should use SHOWCASE_COLLECTION if defined", async () => {
            // Mock env var
            const originalCollection = env.SHOWCASE_COLLECTION;
            env.SHOWCASE_COLLECTION = "TEST-1234";

            (axios.get as any).mockResolvedValue({ data: [] });

            await fetchAcpProducts();

            expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/nfts"), expect.objectContaining({
                params: expect.objectContaining({ collection: "TEST-1234" })
            }));

            // Restore
            env.SHOWCASE_COLLECTION = originalCollection;
        });
    });

    describe("Relayer Logic Error Handling", () => {
        it("should return false when verifySignature fails (e.g. invalid base64)", () => {
            const payload: any = {
                sender: "erd1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6gq4hu", // valid bech32
                receiver: "erd1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6gq4hu",
                nonce: 1,
                value: "0",
                data: "invalid-base-64-%%%",
                signature: "ab"
            };

            // This invalid address CAUSES the error in getRelayerAddress/Address constructor
            const invalidPayload = { ...payload, sender: "invalid-address" };
            const result = RelayerService.verifySignature(invalidPayload);
            expect(result).toBe(false);
        });

        it("should throw when broadcastRelayed fails", async () => {
            const payload: any = {
                sender: "erd1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6gq4hu",
                receiver: "erd1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6gq4hu",
                nonce: 1,
                value: "0",
                data: "",
                signature: "1234567890"
            };

            // Spy on packRelayedTransaction
            jest.spyOn(RelayerService, "packRelayedTransaction").mockRejectedValue(new Error("Packing failed"));

            await expect(RelayerService.broadcastRelayed(payload)).rejects.toThrow("Packing failed");

            jest.restoreAllMocks();
        });
    });
});
