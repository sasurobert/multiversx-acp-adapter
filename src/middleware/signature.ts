import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { env } from "../utils/environment";

const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Verifies the HMAC signature for the given body and timestamp.
 */
export function verifySignature(
    body: string,
    timestamp: string,
    signature: string,
    secret: string
): boolean {
    const expected = crypto
        .createHmac("sha256", secret)
        .update(`${timestamp}.${body}`)
        .digest("base64");

    try {
        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expected)
        );
    } catch (e) {
        return false;
    }
}

/**
 * Middleware to enforce ACP-compliant Request Signatures.
 */
export function signatureMiddleware(req: Request, res: Response, next: NextFunction): void {
    const secret = env.ACP_SIGNING_SECRET || process.env.ACP_SIGNING_SECRET;

    // Skip if not configured (Development mode)
    if (!secret) {
        console.warn("⚠️ ACP_SIGNING_SECRET not configured, skipping signature verification");
        next();
        return;
    }

    const signature = req.headers.signature as string;
    const timestamp = req.headers.timestamp as string;

    if (!signature || !timestamp) {
        res.status(401).json({
            type: "invalid_request",
            code: "missing_signature",
            message: "Missing Signature or Timestamp header",
        });
        return;
    }

    // Check timestamp freshness
    const timestampDate = new Date(timestamp).getTime();
    const now = Date.now();
    if (isNaN(timestampDate) || Math.abs(now - timestampDate) > TIMESTAMP_TOLERANCE_MS) {
        res.status(401).json({
            type: "invalid_request",
            code: "expired_timestamp",
            message: "Request timestamp is too old or too far in the future",
        });
        return;
    }

    // Verify signature
    // Note: express.json() must be used before this middleware
    const bodyString = JSON.stringify(req.body);

    if (!verifySignature(bodyString, timestamp, signature, secret)) {
        res.status(401).json({
            type: "invalid_request",
            code: "invalid_signature",
            message: "Request signature verification failed",
        });
        return;
    }

    next();
}
