import { authMiddleware } from "../../middleware/auth";
import { Request, Response, NextFunction } from "express";

describe("Auth Middleware", () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
        mockReq = { headers: {} };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        mockNext = jest.fn();
        // Reset environment for tests
        delete process.env.ACP_API_KEY;
    });

    it("should reject request without Authorization header", () => {
        process.env.ACP_API_KEY = "valid_test_key";
        authMiddleware(mockReq as Request, mockRes as Response, mockNext);
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({
            type: "invalid_request",
            code: "unauthorized",
            message: "Missing or invalid Authorization header",
        });
        expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject invalid Bearer token", () => {
        process.env.ACP_API_KEY = "valid_test_key";
        mockReq.headers = { authorization: "Bearer invalid_key" };
        authMiddleware(mockReq as Request, mockRes as Response, mockNext);
        expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("should call next() for valid Bearer token", () => {
        process.env.ACP_API_KEY = "valid_test_key";
        mockReq.headers = { authorization: "Bearer valid_test_key" };
        authMiddleware(mockReq as Request, mockRes as Response, mockNext);
        expect(mockNext).toHaveBeenCalled();
    });

    it("should skip auth when ACP_API_KEY not configured (dev mode)", () => {
        delete process.env.ACP_API_KEY;
        mockReq.headers = {};
        authMiddleware(mockReq as Request, mockRes as Response, mockNext);
        expect(mockNext).toHaveBeenCalled();
    });
});
