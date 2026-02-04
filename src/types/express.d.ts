import "express";

declare global {
    namespace Express {
        interface Request {
            locale?: string;
            requestId?: string;
            apiVersion?: string;
        }
    }
}
