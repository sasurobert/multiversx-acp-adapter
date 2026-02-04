# ACP Full Compliance Implementation Plan

**Goal:** Achieve 100% compliance with the OpenAI Agentic Commerce Protocol (ACP) specification including authentication, signatures, idempotency, complete Product Feed, and enhanced checkout responses.

**Architecture:** Implement security middleware layer for auth/signatures/idempotency, enhance existing checkout routes with ACP-compliant responses, and expand product feed with all required fields. Use file-based storage for idempotency keys and extend existing type system.

**Tech Stack:** Express.js middleware, crypto for signatures, existing storage service for idempotency, Jest/supertest for TDD.

---

## Phase 1: Critical Security

### Task 1: Authentication Middleware

**Files:**
- Create: `src/middleware/auth.ts`
- Modify: `src/app.ts:1-20` (add middleware import and use)
- Modify: `src/utils/environment.ts:8-30` (add API_KEY config)
- Test: `src/__tests__/middleware/auth.test.ts`

**Step 1.1: Add API_KEY to environment**

Modify `src/utils/environment.ts`:

```typescript
// Add to Environment interface (line 8)
export interface Environment {
    // ... existing fields ...
    ACP_API_KEY?: string;  // API key for ACP authentication
}

// Add to requiredVars array - make optional for dev
// Add to validateEnv return (around line 51):
    ACP_API_KEY: process.env.ACP_API_KEY,
```

**Step 1.2: Write failing test for auth middleware**

Create `src/__tests__/middleware/auth.test.ts`:

```typescript
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
    });

    it("should reject request without Authorization header", () => {
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
```

**Step 1.3: Run test to verify failure**

```bash
npm test -- src/__tests__/middleware/auth.test.ts
```
Expected: FAIL - module not found

**Step 1.4: Implement auth middleware**

Create `src/middleware/auth.ts`:

```typescript
import { Request, Response, NextFunction } from "express";

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    const apiKey = process.env.ACP_API_KEY;
    
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
```

**Step 1.5: Run test to verify pass**

```bash
npm test -- src/__tests__/middleware/auth.test.ts
```
Expected: PASS

**Step 1.6: Apply middleware to app**

Modify `src/app.ts` (add after line 12):

```typescript
import { authMiddleware } from "./middleware/auth";

// After app.use(express.json()):
app.use("/checkout_sessions", authMiddleware);
```

**Step 1.7: Commit**

```bash
git add src/middleware/auth.ts src/__tests__/middleware/auth.test.ts src/app.ts src/utils/environment.ts
git commit -m "feat: add authentication middleware for ACP checkout endpoints"
```

---

### Task 2: Request Signature Verification

**Files:**
- Create: `src/middleware/signature.ts`
- Test: `src/__tests__/middleware/signature.test.ts`
- Modify: `src/app.ts` (add signature middleware)

**Step 2.1: Write failing test**

Create `src/__tests__/middleware/signature.test.ts`:

```typescript
import { signatureMiddleware, verifySignature } from "../../middleware/signature";
import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

describe("Signature Middleware", () => {
    const TEST_SECRET = "test_webhook_secret_123";
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
        process.env.ACP_SIGNING_SECRET = TEST_SECRET;
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        mockNext = jest.fn();
    });

    it("should verify valid signature", () => {
        const body = JSON.stringify({ items: [{ id: "123", quantity: 1 }] });
        const timestamp = new Date().toISOString();
        const signature = crypto
            .createHmac("sha256", TEST_SECRET)
            .update(`${timestamp}.${body}`)
            .digest("base64");

        mockReq = {
            headers: {
                signature: signature,
                timestamp: timestamp,
            },
            body: { items: [{ id: "123", quantity: 1 }] },
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
        const body = JSON.stringify({ test: "data" });
        const signature = crypto
            .createHmac("sha256", TEST_SECRET)
            .update(`${oldTimestamp}.${body}`)
            .digest("base64");

        mockReq = {
            headers: {
                signature: signature,
                timestamp: oldTimestamp,
            },
            body: { test: "data" },
        };

        signatureMiddleware(mockReq as Request, mockRes as Response, mockNext);
        expect(mockRes.status).toHaveBeenCalledWith(401);
    });
});
```

**Step 2.2: Run test to verify failure**

```bash
npm test -- src/__tests__/middleware/signature.test.ts
```
Expected: FAIL

**Step 2.3: Implement signature middleware**

Create `src/middleware/signature.ts`:

```typescript
import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes

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

    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected)
    );
}

export function signatureMiddleware(req: Request, res: Response, next: NextFunction): void {
    const secret = process.env.ACP_SIGNING_SECRET;

    // Skip if not configured
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
    if (Math.abs(now - timestampDate) > TIMESTAMP_TOLERANCE_MS) {
        res.status(401).json({
            type: "invalid_request",
            code: "expired_timestamp",
            message: "Request timestamp is too old or too far in the future",
        });
        return;
    }

    // Verify signature
    const bodyString = JSON.stringify(req.body);
    try {
        if (!verifySignature(bodyString, timestamp, signature, secret)) {
            res.status(401).json({
                type: "invalid_request",
                code: "invalid_signature",
                message: "Request signature verification failed",
            });
            return;
        }
    } catch (error) {
        res.status(401).json({
            type: "invalid_request",
            code: "invalid_signature",
            message: "Request signature verification failed",
        });
        return;
    }

    next();
}
```

**Step 2.4: Run test**

```bash
npm test -- src/__tests__/middleware/signature.test.ts
```
Expected: PASS

**Step 2.5: Apply to app**

Modify `src/app.ts`:

```typescript
import { signatureMiddleware } from "./middleware/signature";

// After authMiddleware:
app.use("/checkout_sessions", signatureMiddleware);
```

**Step 2.6: Commit**

```bash
git add src/middleware/signature.ts src/__tests__/middleware/signature.test.ts src/app.ts
git commit -m "feat: add request signature verification middleware"
```

---

### Task 3: Idempotency Handling

**Files:**
- Create: `src/middleware/idempotency.ts`
- Create: `src/logic/idempotencyStore.ts`
- Test: `src/__tests__/middleware/idempotency.test.ts`
- Modify: `src/app.ts`

**Step 3.1: Write failing test**

Create `src/__tests__/middleware/idempotency.test.ts`:

```typescript
import request from "supertest";
import express from "express";
import { idempotencyMiddleware, IdempotencyStore } from "../../middleware/idempotency";

describe("Idempotency Middleware", () => {
    let app: express.Express;

    beforeEach(() => {
        IdempotencyStore.clear();
        app = express();
        app.use(express.json());
        app.use(idempotencyMiddleware);
        app.post("/test", (req, res) => {
            res.status(201).json({ id: `response_${Date.now()}`, data: req.body });
        });
    });

    it("should process request normally without idempotency key", async () => {
        const res = await request(app)
            .post("/test")
            .send({ test: "data" });
        expect(res.status).toBe(201);
    });

    it("should return cached response for duplicate idempotency key", async () => {
        const idempotencyKey = "test_key_123";

        const res1 = await request(app)
            .post("/test")
            .set("Idempotency-Key", idempotencyKey)
            .send({ test: "data" });

        const res2 = await request(app)
            .post("/test")
            .set("Idempotency-Key", idempotencyKey)
            .send({ test: "data" });

        expect(res1.body.id).toBe(res2.body.id);
    });

    it("should return 409 for same key with different params", async () => {
        const idempotencyKey = "conflict_key_456";

        await request(app)
            .post("/test")
            .set("Idempotency-Key", idempotencyKey)
            .send({ test: "data1" });

        const res2 = await request(app)
            .post("/test")
            .set("Idempotency-Key", idempotencyKey)
            .send({ test: "different_data" });

        expect(res2.status).toBe(409);
        expect(res2.body.code).toBe("idempotency_conflict");
    });

    it("should echo Idempotency-Key in response headers", async () => {
        const idempotencyKey = "echo_key_789";

        const res = await request(app)
            .post("/test")
            .set("Idempotency-Key", idempotencyKey)
            .send({ test: "data" });

        expect(res.headers["idempotency-key"]).toBe(idempotencyKey);
    });
});
```

**Step 3.2: Run test**

```bash
npm test -- src/__tests__/middleware/idempotency.test.ts
```
Expected: FAIL

**Step 3.3: Implement idempotency middleware**

Create `src/middleware/idempotency.ts`:

```typescript
import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

interface CachedResponse {
    status: number;
    body: any;
    requestHash: string;
    createdAt: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

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

function hashRequest(req: Request): string {
    const data = JSON.stringify({
        method: req.method,
        path: req.path,
        body: req.body,
    });
    return crypto.createHash("sha256").update(data).digest("hex");
}

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
        // Same request = return cached
        if (cached.requestHash === requestHash) {
            res.status(cached.status).json(cached.body);
            return;
        }
        // Different request = conflict
        res.status(409).json({
            type: "invalid_request",
            code: "idempotency_conflict",
            message: "Idempotency key already used with different parameters",
        });
        return;
    }

    // Intercept response to cache it
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
        IdempotencyStore.set(idempotencyKey, res.statusCode, body, requestHash);
        return originalJson(body);
    };

    next();
}
```

**Step 3.4: Run test**

```bash
npm test -- src/__tests__/middleware/idempotency.test.ts
```
Expected: PASS

**Step 3.5: Apply to app and commit**

```bash
git add src/middleware/idempotency.ts src/__tests__/middleware/idempotency.test.ts
git commit -m "feat: add idempotency middleware with cached responses"
```

---

### Task 4: Request/Response Headers Middleware

**Files:**
- Create: `src/middleware/headers.ts`
- Test: `src/__tests__/middleware/headers.test.ts`

**Step 4.1: Write failing test**

Create `src/__tests__/middleware/headers.test.ts`:

```typescript
import request from "supertest";
import express from "express";
import { headersMiddleware } from "../../middleware/headers";

describe("Headers Middleware", () => {
    let app: express.Express;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use(headersMiddleware);
        app.post("/test", (req, res) => {
            res.status(200).json({ locale: (req as any).locale });
        });
    });

    it("should echo Request-Id in response", async () => {
        const res = await request(app)
            .post("/test")
            .set("Request-Id", "req_abc123")
            .send({});

        expect(res.headers["request-id"]).toBe("req_abc123");
    });

    it("should parse Accept-Language header", async () => {
        const res = await request(app)
            .post("/test")
            .set("Accept-Language", "es-ES")
            .send({});

        expect(res.body.locale).toBe("es-ES");
    });

    it("should validate API-Version header when provided", async () => {
        const res = await request(app)
            .post("/test")
            .set("API-Version", "2025-09-12")
            .send({});

        expect(res.status).toBe(200);
    });

    it("should default locale to en-US", async () => {
        const res = await request(app)
            .post("/test")
            .send({});

        expect(res.body.locale).toBe("en-US");
    });
});
```

**Step 4.2: Implement middleware**

Create `src/middleware/headers.ts`:

```typescript
import { Request, Response, NextFunction } from "express";

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

    // Parse API-Version (log warning if unsupported but continue)
    const apiVersion = req.headers["api-version"] as string;
    if (apiVersion) {
        req.apiVersion = apiVersion;
        if (!SUPPORTED_API_VERSIONS.includes(apiVersion)) {
            console.warn(`⚠️ Unsupported API version: ${apiVersion}`);
        }
    }

    next();
}
```

**Step 4.3: Run test and commit**

```bash
npm test -- src/__tests__/middleware/headers.test.ts
git add src/middleware/headers.ts src/__tests__/middleware/headers.test.ts
git commit -m "feat: add ACP request/response headers middleware"
```

---

## Phase 2: Compliance - Product Feed

### Task 5: ACP-Compliant Product Feed

**Files:**
- Modify: `src/logic/products.ts`
- Create: `src/types/productFeed.ts`
- Test: `src/__tests__/productFeed.test.ts`
- Modify: `src/utils/environment.ts` (add SELLER_* config)

**Step 5.1: Add product feed types**

Create `src/types/productFeed.ts`:

```typescript
/**
 * ACP Product Feed Spec Types
 * Based on: https://developers.openai.com/commerce/specs/product-feed
 */

export interface AcpProductFeed {
    item_id: string;
    title: string;
    description: string;
    url: string;
    is_eligible_search: boolean;
    is_eligible_checkout: boolean;
    brand: string;
    price: string;  // "79.99 USD" format
    image_url: string;
    availability: "in_stock" | "out_of_stock" | "pre_order" | "backorder" | "unknown";
    group_id: string;
    listing_has_variations: boolean;
    seller_name: string;
    seller_url: string;
    return_policy: string;
    target_countries: string[];
    store_country: string;
    // Optional fields
    additional_image_urls?: string;
    condition?: string;
    product_category?: string;
    sale_price?: string;
}
```

**Step 5.2: Update environment for seller config**

```typescript
// Add to Environment interface:
    SELLER_NAME: string;
    SELLER_URL: string;
    RETURN_POLICY_URL: string;
    STORE_COUNTRY: string;
```

**Step 5.3: Write failing test**

Create `src/__tests__/productFeed.test.ts`:

```typescript
import { fetchAcpProducts } from "../logic/products";

jest.mock("axios");

describe("ACP Product Feed", () => {
    beforeEach(() => {
        process.env.SELLER_NAME = "Test Store";
        process.env.SELLER_URL = "https://teststore.com";
        process.env.RETURN_POLICY_URL = "https://teststore.com/returns";
        process.env.STORE_COUNTRY = "US";
    });

    it("should return products with all required ACP fields", async () => {
        const products = await fetchAcpProducts();

        expect(products[0]).toHaveProperty("item_id");
        expect(products[0]).toHaveProperty("is_eligible_search");
        expect(products[0]).toHaveProperty("is_eligible_checkout");
        expect(products[0]).toHaveProperty("url");
        expect(products[0]).toHaveProperty("brand");
        expect(products[0]).toHaveProperty("availability");
        expect(products[0]).toHaveProperty("group_id");
        expect(products[0]).toHaveProperty("seller_name");
        expect(products[0]).toHaveProperty("seller_url");
        expect(products[0]).toHaveProperty("return_policy");
        expect(products[0]).toHaveProperty("target_countries");
        expect(products[0]).toHaveProperty("store_country");
    });

    it("should format price as 'amount currency' string", async () => {
        const products = await fetchAcpProducts();
        expect(products[0].price).toMatch(/^\d+(\.\d+)?\s[A-Z]{3,}$/);
    });

    it("should set listing_has_variations correctly", async () => {
        const products = await fetchAcpProducts();
        expect(typeof products[0].listing_has_variations).toBe("boolean");
    });
});
```

**Step 5.4: Implement enhanced products**

Update `src/logic/products.ts`:

```typescript
import axios from "axios";
import { env } from "../utils/environment";
import { AcpProductFeed } from "../types/productFeed";

export async function fetchAcpProducts(): Promise<AcpProductFeed[]> {
    try {
        const params: any = { size: 10 };
        if (env.SHOWCASE_COLLECTION) {
            params.collection = env.SHOWCASE_COLLECTION;
        }

        const url = `${env.API_URL}/nfts`;
        const response = await axios.get(url, { params });
        const items = response.data;

        return items.map((item: any) => {
            const tokenId = item.identifier.split("-").slice(0, 2).join("-");
            const priceValue = item.price || "0";
            
            return {
                item_id: item.identifier,
                title: item.name || item.identifier,
                description: item.attributes?.description || "MultiversX On-chain Asset",
                url: `${env.SELLER_URL}/product/${item.identifier}`,
                is_eligible_search: true,
                is_eligible_checkout: true,
                brand: env.SELLER_NAME,
                price: `${priceValue} EGLD`,
                image_url: item.url || item.media?.[0]?.url || "",
                availability: "in_stock" as const,
                group_id: tokenId,
                listing_has_variations: item.nonce > 1,
                seller_name: env.SELLER_NAME,
                seller_url: env.SELLER_URL,
                return_policy: env.RETURN_POLICY_URL,
                target_countries: [env.STORE_COUNTRY],
                store_country: env.STORE_COUNTRY,
                additional_image_urls: item.media?.slice(1).map((m: any) => m.url).join(","),
                condition: "new",
            };
        });
    } catch (error) {
        console.error("Failed to fetch products:", error);
        return [];
    }
}

// Keep legacy function for backward compatibility
export async function fetchProducts() {
    return fetchAcpProducts();
}
```

**Step 5.5: Update app endpoint**

```typescript
// In src/app.ts, update product feed endpoint:
app.get("/.well-known/acp/products.json", async (req, res) => {
    const products = await fetchAcpProducts();
    res.json({ products });
});
```

**Step 5.6: Commit**

```bash
git add src/logic/products.ts src/types/productFeed.ts src/__tests__/productFeed.test.ts
git commit -m "feat: implement ACP-compliant product feed with all required fields"
```

---

## Phase 3: Enhanced Responses

### Task 6: Fulfillment Options

**Files:**
- Create: `src/logic/fulfillment.ts`
- Modify: `src/routes/checkoutSessions.ts`
- Test: `src/__tests__/fulfillment.test.ts`

**Step 6.1: Create fulfillment service**

Create `src/logic/fulfillment.ts`:

```typescript
import { FulfillmentOption, Address } from "../types/acp";

export class FulfillmentService {
    /**
     * Get available fulfillment options based on address
     */
    static getOptions(address?: Address): FulfillmentOption[] {
        // For digital/NFT products, return digital fulfillment
        const digitalOption: FulfillmentOption = {
            type: "digital",
            id: "digital_instant",
            title: "Instant Delivery",
            subtitle: "NFT will be transferred to your wallet immediately",
            subtotal: 0,
            tax: 0,
            total: 0,
        };

        if (!address) {
            return [digitalOption];
        }

        // If address provided, also offer shipping for physical merch
        const standardShipping: FulfillmentOption = {
            type: "shipping",
            id: "shipping_standard",
            title: "Standard Shipping",
            subtitle: "Arrives in 5-7 business days",
            carrier: "USPS",
            earliest_delivery_time: FulfillmentService.addDays(5),
            latest_delivery_time: FulfillmentService.addDays(7),
            subtotal: 500,
            tax: 0,
            total: 500,
        };

        const expressShipping: FulfillmentOption = {
            type: "shipping",
            id: "shipping_express",
            title: "Express Shipping",
            subtitle: "Arrives in 2-3 business days",
            carrier: "FedEx",
            earliest_delivery_time: FulfillmentService.addDays(2),
            latest_delivery_time: FulfillmentService.addDays(3),
            subtotal: 1500,
            tax: 0,
            total: 1500,
        };

        return [digitalOption, standardShipping, expressShipping];
    }

    static getDefaultOptionId(options: FulfillmentOption[]): string {
        return options[0]?.id || "";
    }

    private static addDays(days: number): string {
        const date = new Date();
        date.setDate(date.getDate() + days);
        return date.toISOString();
    }
}
```

**Step 6.2: Update checkout sessions to use fulfillment**

Modify `src/routes/checkoutSessions.ts` create handler:

```typescript
import { FulfillmentService } from "../logic/fulfillment";

// In POST / handler, after creating lineItems:
const fulfillmentOptions = FulfillmentService.getOptions(body.fulfillment_address);
const defaultFulfillmentId = FulfillmentService.getDefaultOptionId(fulfillmentOptions);

const session: CheckoutSession = {
    // ... existing fields ...
    fulfillment_options: fulfillmentOptions,
    fulfillment_option_id: defaultFulfillmentId,
    messages: [],
};
```

**Step 6.3: Write test and commit**

```bash
npm test -- src/__tests__/fulfillment.test.ts
git add src/logic/fulfillment.ts src/__tests__/fulfillment.test.ts src/routes/checkoutSessions.ts
git commit -m "feat: implement fulfillment options with digital and shipping"
```

---

### Task 7: Complete Order Response

**Files:**
- Modify: `src/types/acp.ts` (add Order interface)
- Modify: `src/routes/checkoutSessions.ts`
- Modify: `src/utils/environment.ts`

**Step 7.1: Add Order type and permalink config**

Add to `src/types/acp.ts`:

```typescript
export interface Order {
    id: string;
    checkout_session_id: string;
    permalink_url: string;
}
```

Add to environment:

```typescript
    ORDER_PERMALINK_BASE_URL: string;  // e.g., "https://mystore.com/orders"
```

**Step 7.2: Update complete handler**

In `src/routes/checkoutSessions.ts`, update complete:

```typescript
// After creating order_id:
const orderId = `order_${randomUUID()}`;
const order: Order = {
    id: orderId,
    checkout_session_id: session.id,
    permalink_url: `${env.ORDER_PERMALINK_BASE_URL}/${orderId}`,
};

session.order = order;
session.status = "completed";
```

**Step 7.3: Test and commit**

```bash
npm test
git add src/types/acp.ts src/routes/checkoutSessions.ts src/utils/environment.ts
git commit -m "feat: return complete Order object with permalink_url"
```

---

### Task 8: Enhanced Webhooks

**Files:**
- Modify: `src/types/acp.ts` (add Refund type)
- Modify: `src/logic/webhooks.ts`

**Step 8.1: Add refund types**

Add to `src/types/acp.ts`:

```typescript
export type RefundType = "store_credit" | "original_payment";

export interface Refund {
    type: RefundType;
    amount: number;
}

// Update OrderEventData:
export interface OrderEventData {
    // ... existing fields ...
    permalink_url: string;
    refunds: Refund[];
}
```

**Step 8.2: Update webhook service**

Update `src/logic/webhooks.ts`:

```typescript
static createOrderCreatedEvent(orderData: OrderEventData): WebhookEvent {
    return {
        type: "order.created",
        timestamp: new Date().toISOString(),
        data: {
            ...orderData,
            permalink_url: orderData.permalink_url || "",
            refunds: orderData.refunds || [],
        },
    };
}
```

**Step 8.3: Commit**

```bash
git add src/types/acp.ts src/logic/webhooks.ts
git commit -m "feat: add permalink_url and refunds to webhook events"
```

---

### Task 9: Error Messages in Response

**Files:**
- Create: `src/logic/messages.ts`
- Modify: `src/routes/checkoutSessions.ts`

**Step 9.1: Create messages helper**

Create `src/logic/messages.ts`:

```typescript
import { Message, MessageCode } from "../types/acp";

export class MessageService {
    static createError(code: MessageCode, path: string, content: string): Message {
        return {
            type: "error",
            code,
            path,
            content_type: "plain",
            content,
        };
    }

    static createInfo(path: string, content: string): Message {
        return {
            type: "info",
            path,
            content_type: "plain",
            content,
        };
    }

    static outOfStock(itemIndex: number, itemName: string): Message {
        return this.createError(
            "out_of_stock",
            `$.line_items[${itemIndex}]`,
            `${itemName} is currently out of stock`
        );
    }

    static missingAddress(): Message {
        return this.createError(
            "missing",
            "$.fulfillment_address",
            "A shipping address is required to complete this order"
        );
    }
}
```

**Step 9.2: Use in checkout sessions**

Add to session creation when no address:

```typescript
const messages: Message[] = [];
if (!body.fulfillment_address) {
    messages.push(MessageService.missingAddress());
}
```

**Step 9.3: Commit**

```bash
git add src/logic/messages.ts src/routes/checkoutSessions.ts
git commit -m "feat: add structured error messages to checkout responses"
```

---

### Task 10: Integration Test Suite

**Files:**
- Create: `src/__tests__/acp-compliance.test.ts`

**Step 10.1: Write comprehensive integration test**

Create `src/__tests__/acp-compliance.test.ts`:

```typescript
import request from "supertest";
import { app } from "../app";
import { StorageService } from "../logic/storage";
import crypto from "crypto";

describe("ACP Full Compliance Tests", () => {
    const API_KEY = "test_api_key";
    const SIGNING_SECRET = "test_signing_secret";

    beforeAll(() => {
        process.env.ACP_API_KEY = API_KEY;
        process.env.ACP_SIGNING_SECRET = SIGNING_SECRET;
    });

    beforeEach(() => {
        StorageService.sessions = {};
    });

    function signRequest(body: object, timestamp: string): string {
        return crypto
            .createHmac("sha256", SIGNING_SECRET)
            .update(`${timestamp}.${JSON.stringify(body)}`)
            .digest("base64");
    }

    describe("Authentication", () => {
        it("should require Authorization header", async () => {
            const res = await request(app)
                .post("/checkout_sessions")
                .send({ items: [{ id: "test", quantity: 1 }] });
            
            expect(res.status).toBe(401);
        });

        it("should accept valid Bearer token", async () => {
            const body = { items: [{ id: "test", quantity: 1 }] };
            const timestamp = new Date().toISOString();
            
            const res = await request(app)
                .post("/checkout_sessions")
                .set("Authorization", `Bearer ${API_KEY}`)
                .set("Signature", signRequest(body, timestamp))
                .set("Timestamp", timestamp)
                .send(body);
            
            expect(res.status).toBe(201);
        });
    });

    describe("Idempotency", () => {
        it("should return cached response for duplicate key", async () => {
            const body = { items: [{ id: "test", quantity: 1 }] };
            const timestamp = new Date().toISOString();
            const idempotencyKey = "test_idem_key";

            const res1 = await request(app)
                .post("/checkout_sessions")
                .set("Authorization", `Bearer ${API_KEY}`)
                .set("Signature", signRequest(body, timestamp))
                .set("Timestamp", timestamp)
                .set("Idempotency-Key", idempotencyKey)
                .send(body);

            const res2 = await request(app)
                .post("/checkout_sessions")
                .set("Authorization", `Bearer ${API_KEY}`)
                .set("Signature", signRequest(body, timestamp))
                .set("Timestamp", timestamp)
                .set("Idempotency-Key", idempotencyKey)
                .send(body);

            expect(res1.body.id).toBe(res2.body.id);
            expect(res1.headers["idempotency-key"]).toBe(idempotencyKey);
        });
    });

    describe("Response Structure", () => {
        it("should include all required fields in session response", async () => {
            const body = { items: [{ id: "test", quantity: 1 }] };
            const timestamp = new Date().toISOString();
            
            const res = await request(app)
                .post("/checkout_sessions")
                .set("Authorization", `Bearer ${API_KEY}`)
                .set("Signature", signRequest(body, timestamp))
                .set("Timestamp", timestamp)
                .send(body);

            expect(res.body).toHaveProperty("id");
            expect(res.body).toHaveProperty("status");
            expect(res.body).toHaveProperty("currency");
            expect(res.body).toHaveProperty("line_items");
            expect(res.body).toHaveProperty("totals");
            expect(res.body).toHaveProperty("fulfillment_options");
            expect(res.body).toHaveProperty("messages");
            expect(res.body).toHaveProperty("links");
            expect(res.body).toHaveProperty("payment_provider");
        });

        it("should return Order object on complete", async () => {
            // Create session with address
            const createBody = {
                items: [{ id: "test", quantity: 1 }],
                fulfillment_address: {
                    name: "Test",
                    line_one: "123 Main St",
                    city: "NYC",
                    state: "NY",
                    country: "US",
                    postal_code: "10001",
                },
            };
            const timestamp = new Date().toISOString();

            const createRes = await request(app)
                .post("/checkout_sessions")
                .set("Authorization", `Bearer ${API_KEY}`)
                .set("Signature", signRequest(createBody, timestamp))
                .set("Timestamp", timestamp)
                .send(createBody);

            const sessionId = createRes.body.id;

            // Complete session
            const completeBody = {
                buyer: { name: "Test User", email: "test@test.com" },
                payment_data: { token: "tok_123", provider: "multiversx" },
            };

            const completeRes = await request(app)
                .post(`/checkout_sessions/${sessionId}/complete`)
                .set("Authorization", `Bearer ${API_KEY}`)
                .set("Signature", signRequest(completeBody, timestamp))
                .set("Timestamp", timestamp)
                .send(completeBody);

            expect(completeRes.body.order).toHaveProperty("id");
            expect(completeRes.body.order).toHaveProperty("checkout_session_id");
            expect(completeRes.body.order).toHaveProperty("permalink_url");
        });
    });
});
```

**Step 10.2: Run full test suite**

```bash
npm test
```
Expected: ALL PASS

**Step 10.3: Final commit**

```bash
git add src/__tests__/acp-compliance.test.ts
git commit -m "test: add comprehensive ACP compliance integration tests"
```

### Task 11: Delegated Payment Spec Alignment

**Files:**
- Modify: `src/app.ts`
- Modify: `src/logic/relayer.ts`
- Test: `src/__tests__/delegatedPayment.test.ts`

**Step 11.1: Update endpoint path**

In `src/app.ts`, rename `/delegate_payment` to `/agentic_commerce/delegate_payment`.

**Step 11.2: Add RFC 3339 timestamp to response**

In `src/app.ts`, POST `/agentic_commerce/delegate_payment` handler:

```typescript
res.json({ 
    id: paymentToken,
    created: new Date().toISOString()
});
```

**Step 11.3: Add validation for standard card payments (return 400)**

Since this is a MultiversX adapter, standard card payments aren't handled. We should return a clear error if they are attempted.

```typescript
if (req.body.payment_method?.type === "card") {
    return res.status(400).json({
        type: "invalid_request",
        code: "unsupported_payment_method",
        message: "This adapter only supports MultiversX crypto relayed transactions"
    });
}
```

**Step 11.4: Commit**

```bash
git add src/app.ts src/logic/relayer.ts
git commit -m "feat: align delegated payment endpoint with ACP spec path and response"
```

---

## Verification Plan
... (rest of the file)

### Automated Tests

Run the complete test suite:

```bash
npm test
```

Run with coverage:

```bash
npm run test:coverage
```

Expected coverage targets:
- Middleware: 100%
- Routes: 90%+
- Logic: 85%+

### Manual Verification

1. **Start the server**:
   ```bash
   npm run dev
   ```

2. **Test product feed**:
   ```bash
   curl http://localhost:4000/.well-known/acp/products.json | jq .
   ```
   Verify: Response contains products with all required ACP fields

3. **Test authentication rejection**:
   ```bash
   curl -X POST http://localhost:4000/checkout_sessions \
     -H "Content-Type: application/json" \
     -d '{"items":[{"id":"test","quantity":1}]}'
   ```
   Verify: Returns 401 Unauthorized (when ACP_API_KEY is set)

4. **Test full checkout flow**:
   ```bash
   # Set API key in .env, then:
   curl -X POST http://localhost:4000/checkout_sessions \
     -H "Authorization: Bearer your_api_key" \
     -H "Content-Type: application/json" \
     -d '{"items":[{"id":"test","quantity":1}]}'
   ```
   Verify: Returns 201 with complete session object

---

## Environment Variables Required

Add to `.env.example`:

```env
# ACP Security (Required for production)
ACP_API_KEY=your_api_key_here
ACP_SIGNING_SECRET=your_signing_secret_here

# Seller Configuration (Required for Product Feed)
SELLER_NAME=Your Store Name
SELLER_URL=https://yourstore.com
RETURN_POLICY_URL=https://yourstore.com/returns
STORE_COUNTRY=US
ORDER_PERMALINK_BASE_URL=https://yourstore.com/orders
```

---

## Summary

| Task | Files Created | Files Modified | Tests Added |
|:-----|:--------------|:---------------|:------------|
| 1. Auth Middleware | `middleware/auth.ts` | `app.ts`, `environment.ts` | `auth.test.ts` |
| 2. Signature Verification | `middleware/signature.ts` | `app.ts` | `signature.test.ts` |
| 3. Idempotency | `middleware/idempotency.ts` | `app.ts` | `idempotency.test.ts` |
| 4. Headers | `middleware/headers.ts` | `app.ts` | `headers.test.ts` |
| 5. Product Feed | `types/productFeed.ts` | `logic/products.ts` | `productFeed.test.ts` |
| 6. Fulfillment | `logic/fulfillment.ts` | `routes/checkoutSessions.ts` | `fulfillment.test.ts` |
| 7. Order Response | - | `types/acp.ts`, `routes/checkoutSessions.ts` | existing |
| 8. Webhooks | - | `types/acp.ts`, `logic/webhooks.ts` | existing |
| 9. Messages | `logic/messages.ts` | `routes/checkoutSessions.ts` | existing |
| 10. Integration | `acp-compliance.test.ts` | - | full suite |
| 11. Delegated Payment | - | `app.ts`, `relayer.ts` | `delegatedPayment.test.ts` |

**Total: 10 new files, 9 modified files, 11 test files**
