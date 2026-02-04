import axios from "axios";
import { WebhookService } from "../logic/webhooks";
jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;
jest.mock("../utils/logger", () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    }
}));
import { logger } from "../utils/logger";
const mockedLogger = logger as jest.Mocked<typeof logger>;

jest.mock("../utils/environment", () => ({
    env: {
        OPENAI_WEBHOOK_URL: "https://mock.openai.com/webhook",
        OPENAI_WEBHOOK_SECRET: "mock_secret",
        SELLER_NAME: "Test Store"
    }
}));

describe("Webhook Reliability (Retry Logic)", () => {
    const mockEvent = {
        type: "order_created" as const,
        timestamp: new Date().toISOString(),
        data: {
            type: "order" as const,
            order_id: "order_123",
            checkout_session_id: "sess_123",
            total_amount: 1000,
            status: "confirmed" as const,
            currency: "EGLD",
            line_items: [],
            buyer: { email: "test@example.com", name: "Test User" },
            permalink_url: "https://multiversx.com/orders/order_123",
            refunds: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }
    };

    beforeEach(() => {
        jest.clearAllMocks();
        // Speed up tests by shortening delay
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("should retry upon failure and eventually succeed", async () => {
        // Fail twice, succeed third time
        mockedAxios.post
            .mockRejectedValueOnce(new Error("Network Error"))
            .mockRejectedValueOnce(new Error("Timeout"))
            .mockResolvedValueOnce({ status: 200 });

        const sendPromise = WebhookService.sendWebhook(mockEvent, 3);

        // Advance past first failure and timer
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        jest.runOnlyPendingTimers();

        // Advance past second failure and timer
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        jest.runOnlyPendingTimers();

        await sendPromise;

        expect(mockedAxios.post).toHaveBeenCalledTimes(3);
        expect(mockedLogger.info).toHaveBeenCalledWith(
            expect.objectContaining({ eventType: "order_created" }),
            expect.stringContaining("Webhook sent")
        );
    });

    it("should fail after max retries", async () => {
        mockedAxios.post.mockRejectedValue(new Error("Persistent Error"));

        const sendPromise = WebhookService.sendWebhook(mockEvent, 2);

        // Attempt 1 fails, delay starts
        await Promise.resolve();
        jest.runAllTimers();

        // Attempt 2 fails, max retries reached
        await sendPromise;

        expect(mockedAxios.post).toHaveBeenCalledTimes(2);
        expect(mockedLogger.error).toHaveBeenCalledWith(
            expect.objectContaining({ attempt: 2 }),
            expect.stringContaining("Failed to send webhook after max retries")
        );
    });
});
