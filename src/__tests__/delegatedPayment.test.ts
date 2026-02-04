import request from "supertest";
import { app } from "../app";
import crypto from "crypto";
import { RelayerService } from "../logic/relayer";

jest.mock("../logic/relayer", () => ({
    RelayerService: {
        verifySignature: jest.fn().mockReturnValue(true)
    }
}));

describe("Delegated Payment Alignment", () => {
    const API_KEY = "test_api_key_123";
    const SIGNING_SECRET = "test_signing_secret_456";

    beforeAll(() => {
        process.env.ACP_API_KEY = API_KEY;
        process.env.ACP_SIGNING_SECRET = SIGNING_SECRET;
    });

    function getAuthHeaders(body: any = {}) {
        const timestamp = new Date().toISOString();
        const bodyStr = JSON.stringify(body);
        const signature = crypto
            .createHmac("sha256", SIGNING_SECRET)
            .update(`${timestamp}.${bodyStr}`)
            .digest("base64");

        return {
            "Authorization": `Bearer ${API_KEY}`,
            "Signature": signature,
            "Timestamp": timestamp,
        };
    }

    it("should accept payment at /agentic_commerce/delegate_payment", async () => {
        const body = {
            signature: "mock_sig",
            sender: "erd1qyu5wth66p63p4p9ct55393u8yk8358485kwnfayqay7zrtf98sqe4u2rs",
            receiver: "erd1spy9qqz890v06y62600gq74m78u8yye8r5054cy9a39j229fs6cqdqz46u",
            nonce: 1,
            value: "0",
            gasLimit: 60000000,
            chainId: "D",
            data: "YnV5QFRva2VuSGV4QE5vbmNlQFF0eQ==" // Valid base64
        };

        const res = await request(app)
            .post("/agentic_commerce/delegate_payment")
            .set(getAuthHeaders(body))
            .send(body);

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty("id");
        expect(res.body).toHaveProperty("created");
        // Verify ISO format
        expect(new Date(res.body.created).toISOString()).toBe(res.body.created);
    });

    it("should reject card payment requests with 400", async () => {
        const body = {
            payment_method: { type: "card" }
        };

        const res = await request(app)
            .post("/agentic_commerce/delegate_payment")
            .set(getAuthHeaders(body))
            .send(body);

        expect(res.status).toBe(400);
        expect(res.body.code).toBe("unsupported_payment_method");
    });
});
