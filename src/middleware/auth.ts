import { Request, Response, NextFunction } from "express";
import { env } from "../utils/environment";

/**
 * Middleware to enforce ACP-compliant Bearer token authentication.
 * If ACP_API_KEY is not configured in the environment, it skips authentication (Development mode).
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    const apiKey = env.ACP_API_KEY || process.env.ACP_API_KEY;

    // Skip auth if not configured (dev mode)
    if (!apiKey) {
        console.warn("⚠️ ACP_API_KEY not configured, skipping authentication");
        next();
        return;
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({
            type: "invalid_request",
            code: "unauthorized",
            message: "Missing or invalid Authorization header",
        });
        return;
    }

    const token = authHeader.substring(7);

    if (token !== apiKey) {
        res.status(401).json({
            type: "invalid_request",
            code: "unauthorized",
            message: "Missing or invalid Authorization header",
        });
        return;
    }

    next();
}
