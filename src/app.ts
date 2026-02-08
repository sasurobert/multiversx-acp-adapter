import express, { Request, Response } from "express";
import { fetchProducts } from "./logic/products";
import { logger } from "./utils/logger";
import { env } from "./utils/environment";
import { RelayerService, RelayedPayload } from "./logic/relayer";
import { NegotiationService, RFP } from "./logic/negotiation";
import { EscrowService } from "./logic/escrow";
import { StorageService } from "./logic/storage";
import { checkoutSessionsRouter } from "./routes/checkoutSessions";
import { authMiddleware } from "./middleware/auth";
import { signatureMiddleware } from "./middleware/signature";
import { idempotencyMiddleware } from "./middleware/idempotency";
import { headersMiddleware } from "./middleware/headers";

export const app = express();

app.use(express.json());

// Initialize Storage
StorageService.init();

// ACP-compliant security and headers middleware
const acpSecurity = [
    authMiddleware,
    signatureMiddleware,
    idempotencyMiddleware,
    headersMiddleware
];

// Mount ACP-compliant checkout sessions routes
app.use("/checkout_sessions", ...acpSecurity, checkoutSessionsRouter);

/**
 * 0. Negotiation Endpoint (ACP Phase 1)
 * POST /negotiate
 */
app.post("/negotiate", async (req: Request, res: Response) => {
    try {
        const rfp = req.body as RFP;

        // Basic Validation
        if (!rfp.rfp_id || !rfp.client_id || !rfp.budget_limit) {
            res.status(400).json({
                type: "invalid_request",
                code: "invalid_request",
                message: "Missing required RFP fields"
            });
            return;
        }

        const proposal = await NegotiationService.createProposal(rfp);

        // Store Job Persistently
        StorageService.setJob(proposal.job_id, {
            id: proposal.job_id,
            status: "NEGOTIATED",
            rfp,
            proposal
        });

        res.json({
            status: "accepted",
            proposal,
            poa_data: {
                rfp_id: rfp.rfp_id,
                job_id: proposal.job_id,
                vendor: env.VENDOR_ADDRESS,
                client: rfp.client_id,
                price: proposal.price,
                token: proposal.token
            }
        });
    } catch (error) {
        logger.error({ error }, "Negotiation failed");
        res.status(500).json({
            type: "processing_error",
            code: "processing_error",
            message: error instanceof Error ? error.message : "Internal Server Error"
        });
    }
});

/**
 * 1. Product Feed Endpoint
 * GET /.well-known/acp/products.json
 */
app.get("/.well-known/acp/products.json", async (req: Request, res: Response) => {
    const products = await fetchProducts();
    res.json({ products });
});

/**
 * 2. Checkout Endpoint
 * POST /checkout
 */
app.post("/checkout", async (req: Request, res: Response) => {
    const { product_id, job_id, type } = req.body;

    // --- ESCROW FLOW (V2) ---
    if (type === "escrow") {
        if (!job_id) {
            return res.status(400).json({
                type: "invalid_request",
                code: "invalid_request",
                message: "Missing job_id for escrow checkout"
            });
        }

        const job = StorageService.jobs[job_id];

        if (!job) {
            return res.status(404).json({ error: "Job not found" });
        }

        const proposal = job.proposal;

        // Build Deposit Payload using ABI-based logic
        const data = await EscrowService.buildDepositPayload({
            job_id: proposal.job_id,
            token: proposal.token,
            token_nonce: 0, // Default to 0 for EGLD/Fungible ESDT
            amount: proposal.price,
            agent_nonce: 0, // Default for new protocol initialization
            service_id: "default",
            validator_address: env.ESCROW_ADDRESS
        });

        // Convert base64 from ABI factory to hex for the response if needed, 
        // but ACP usually expects base64 or hex depending on the client. 
        // Here we'll convert to hex to match previous behavior if expected.
        const dataHex = Buffer.from(data, 'base64').toString('hex');

        res.json({
            status: "requires_action",
            next_action: {
                type: "sign_transaction",
                chain_id: env.CHAIN_ID,
                receiver: env.ESCROW_ADDRESS,
                value: "0", // Access value from ESDTTransfer or direct EGLD
                gasLimit: env.GAS_LIMIT,
                data: dataHex
            }
        });
        return;
    }

    // --- RETAIL FLOW (V1) ---
    if (!product_id) {
        return res.status(400).json({
            type: "invalid_request",
            code: "invalid_request",
            message: "Missing product_id"
        });
    }

    const products = await fetchProducts();
    const product = products.find(p => p.product_id === product_id);

    if (!product) {
        return res.status(404).json({
            type: "invalid_request",
            code: "not_found",
            message: "Product not found or not in showcase"
        });
    }

    // Construct Transaction Data
    const tokenHex = Buffer.from(product.custom_attributes.token_id).toString("hex");
    const nonceHex = product.custom_attributes.nonce.toString(16).padStart(2, "0");
    const nonceEven = nonceHex.length % 2 !== 0 ? `0${nonceHex}` : nonceHex;
    const quantityHex = "01"; // Default 1

    // "buy@TokenHex@Nonce@Qty"
    const data = `buy@${tokenHex}@${nonceEven}@${quantityHex}`;

    // USE CONFIGURABLE ADDRESS
    const dAppUrl = `${env.WALLET_URL}/hook/sign?data=${data}&receiver=${env.MARKETPLACE_ADDRESS}`;

    // Return ACP-compliant "Action"
    res.json({
        status: "requires_action",
        next_action: {
            type: "use_dapp_wallet",
            dapp_url: dAppUrl
        }
    });
});

// --- V2: Relayer Endpoints ---

/**
 * 3. Delegate Payment (V2)
 * Agent sends the signed payload here instead of User clicking a link.
 * Path aligned with ACP Delegated Payment Spec.
 */
app.post("/agentic_commerce/delegate_payment", ...acpSecurity, async (req: Request, res: Response) => {
    const body = req.body;

    // Validate if standard card payment (unsupported by this crypto-relayer)
    if (body.payment_method?.type === "card") {
        return res.status(400).json({
            type: "invalid_request",
            code: "unsupported_payment_method",
            message: "This adapter only supports MultiversX crypto relayed transactions"
        });
    }

    const payload = body as RelayedPayload;

    // Validate MultiversX Signature
    const isValid = RelayerService.verifySignature(payload);

    if (!isValid) {
        return res.status(401).json({
            type: "invalid_request",
            code: "unauthorized",
            message: "Invalid MultiversX signature"
        });
    }

    // Generate Payment Token (Ref ID)
    const paymentToken = `acp_mvx_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    // Store payload persistently
    StorageService.setPayment(paymentToken, {
        token: paymentToken,
        status: "pending",
        payload
    });

    res.status(201).json({
        id: paymentToken,
        created: new Date().toISOString()
    });
});

/**
 * 4. Capture (V2)
 * Merchant calls this to trigger the broadcast.
 */
app.post("/capture", async (req: Request, res: Response) => {
    const { payment_token } = req.body;

    const payload = StorageService.payments[payment_token];

    if (!payload) {
        return res.status(404).json({
            type: "invalid_request",
            code: "not_found",
            message: "Invalid payment token"
        });
    }

    // Broadcast
    const txHash = await RelayerService.broadcastRelayed(payload.payload);

    res.json({
        status: "processing",
        tx_hash: txHash
    });
});

