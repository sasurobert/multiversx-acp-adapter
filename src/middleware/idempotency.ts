import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

interface CachedResponse {
    status: number;
    body: any;
    requestHash: string;
    createdAt: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * In-memory store for idempotency cached responses.
 * For production, this should use Redis or a database.
 */
export class IdempotencyStore {
    private static cache: Map<string, CachedResponse> = new Map();

    static get(key: string): CachedResponse | undefined {
        const entry = this.cache.get(key);
        if (entry && Date.now() - entry.createdAt > CACHE_TTL_MS) {
            this.cache.delete(key);
            return undefined;
        }
        return entry;
    }

    static set(key: string, status: number, body: any, requestHash: string): void {
        this.cache.set(key, {
            status,
            body,
            requestHash,
            createdAt: Date.now(),
        });
    }

    static clear(): void {
        this.cache.clear();
    }
}

/**
 * Generates a hash of the request to identify duplicate parameters.
 */
function hashRequest(req: Request): string {
    const data = JSON.stringify({
        method: req.method,
        path: req.path,
        body: req.body,
    });
    return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * Middleware to handle ACP Idempotency-Key.
 */
export function idempotencyMiddleware(req: Request, res: Response, next: NextFunction): void {
    const idempotencyKey = req.headers["idempotency-key"] as string;

    // No key = normal processing
    if (!idempotencyKey) {
        next();
        return;
    }

    // Echo key in response
    res.setHeader("Idempotency-Key", idempotencyKey);

    const requestHash = hashRequest(req);
    const cached = IdempotencyStore.get(idempotencyKey);

    if (cached) {
        // Same requestParams = return cached response
        if (cached.requestHash === requestHash) {
            res.status(cached.status).json(cached.body);
            return;
        }
        // Different requestParams = conflict
        res.status(409).json({
            type: "invalid_request",
            code: "idempotency_conflict",
            message: "Idempotency key already used with different parameters",
        });
        return;
    }

    // Wrap the response.json method to capture the success responses
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
        // Only cache successful or non-server-error responses if needed
        // For ACP, we typically cache the final result
        if (res.statusCode >= 200 && res.statusCode < 500) {
            IdempotencyStore.set(idempotencyKey, res.statusCode, body, requestHash);
        }
        return originalJson(body);
    };

    next();
}
