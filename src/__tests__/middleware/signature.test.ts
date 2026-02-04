import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { signatureMiddleware } from "../../middleware/signature";
import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

describe("Signature Middleware", () => {
    const TEST_SECRET = "test_webhook_secret_123";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mockReq: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mockRes: any;
    let mockNext: NextFunction;

    beforeEach(() => {
        process.env.ACP_SIGNING_SECRET = TEST_SECRET;
        mockRes = {
            status: jest.fn().mockReturnThis() as any, // eslint-disable-line @typescript-eslint/no-explicit-any
            json: jest.fn().mockReturnThis() as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        };
        mockNext = jest.fn();
    });

    it("should verify valid signature", () => {
        const bodyPayload = { items: [{ id: "123", quantity: 1 }] };
        const bodyContent = JSON.stringify(bodyPayload);
        const timestamp = new Date().toISOString();
        const signature = crypto
            .createHmac("sha256", TEST_SECRET)
            .update(`${timestamp}.${bodyContent}`)
            .digest("base64");

        mockReq = {
            headers: {
                signature: signature,
                timestamp: timestamp,
            },
            body: bodyPayload,
        };

        signatureMiddleware(mockReq as Request, mockRes as Response, mockNext);
        expect(mockNext).toHaveBeenCalled();
    });

    it("should reject missing signature header", () => {
        mockReq = {
            headers: { timestamp: new Date().toISOString() },
            body: {},
        };

        signatureMiddleware(mockReq as Request, mockRes as Response, mockNext);
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject invalid signature", () => {
        mockReq = {
            headers: {
                signature: "invalid_signature",
                timestamp: new Date().toISOString(),
            },
            body: { test: "data" },
        };

        signatureMiddleware(mockReq as Request, mockRes as Response, mockNext);
        expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("should reject expired timestamp (>5 min)", () => {
        const oldTimestamp = new Date(Date.now() - 6 * 60 * 1000).toISOString();
        const bodyPayload = { test: "data" };
        const bodyContent = JSON.stringify(bodyPayload);
        const signature = crypto
            .createHmac("sha256", TEST_SECRET)
            .update(`${oldTimestamp}.${bodyContent}`)
            .digest("base64");

        mockReq = {
            headers: {
                signature: signature,
                timestamp: oldTimestamp,
            },
            body: bodyPayload,
        };

        signatureMiddleware(mockReq as Request, mockRes as Response, mockNext);
        expect(mockRes.status).toHaveBeenCalledWith(401);
    });
});
