import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

declare global {
    namespace Express {
        interface Request {
            locale?: string;
            requestId?: string;
            apiVersion?: string;
        }
    }
}

const SUPPORTED_API_VERSIONS = ["2025-09-12"];

/**
 * Middleware to handle ACP-specific headers and echo them back.
 */
export function headersMiddleware(req: Request, res: Response, next: NextFunction): void {
    // Echo Request-Id
    const requestId = req.headers["request-id"] as string;
    if (requestId) {
        req.requestId = requestId;
        res.setHeader("Request-Id", requestId);
    }

    // Parse Accept-Language
    const acceptLanguage = req.headers["accept-language"] as string;
    req.locale = acceptLanguage || "en-US";

    // Parse API-Version
    const apiVersion = req.headers["api-version"] as string;
    if (apiVersion) {
        req.apiVersion = apiVersion;
        if (!SUPPORTED_API_VERSIONS.includes(apiVersion)) {
            logger.warn({ apiVersion }, "⚠️ Unsupported API version");
        }
    }

    next();
}
