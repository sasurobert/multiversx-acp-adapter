import express from "express";
import { fetchProducts } from "./logic/products";
import { env } from "./utils/environment";
import { RelayerService, RelayedPayload } from "./logic/relayer";
import { NegotiationService, RFP } from "./logic/negotiation";
import { EscrowService } from "./logic/escrow";
import { StorageService } from "./logic/storage";
import { checkoutSessionsRouter } from "./routes/checkoutSessions";

export const app = express();

app.use(express.json());

// Initialize Storage
StorageService.init();

// Mount ACP-compliant checkout sessions routes
app.use("/checkout_sessions", checkoutSessionsRouter);

/**
 * 0. Negotiation Endpoint (ACP Phase 1)
 * POST /negotiate
 */
app.post("/negotiate", async (req, res) => {
    try {
        const rfp = req.body as RFP;

        // Basic Validation
        if (!rfp.rfp_id || !rfp.client_id || !rfp.budget_limit) {
            res.status(400).json({ error: "Missing required RFP fields" });
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
        console.error("Negotiation failed:", error);
        res.status(500).json({ error: error instanceof Error ? error.message : "Internal Server Error" });
    }
});

/**
 * 1. Product Feed Endpoint
 * GET /.well-known/acp/products.json
 */
app.get("/.well-known/acp/products.json", async (req, res) => {
    const products = await fetchProducts();
    res.json({ products });
});

/**
 * 2. Checkout Endpoint
 * POST /checkout
 */
app.post("/checkout", async (req, res) => {
    const { product_id, job_id, type } = req.body;

    // --- ESCROW FLOW (V2) ---
    if (type === "escrow") {
        if (!job_id) {
            return res.status(400).json({ error: "Missing job_id for escrow checkout" });
        }

        const job = StorageService.jobs[job_id];

        if (!job) {
            return res.status(404).json({ error: "Job not found" });
        }

        const proposal = (job as any).proposal;

        // Build Deposit Payload
        const data = EscrowService.buildDepositPayload({
            job_id: proposal.job_id,
            token: proposal.token,
            amount: proposal.price,
            vendor: env.VENDOR_ADDRESS,
            poa_hash: proposal.vendor_signature.slice(0, 64) // Using signature prefix or a proper hash as PoA
        });

        res.json({
            status: "requires_action",
            next_action: {
                type: "sign_transaction",
                chain_id: env.CHAIN_ID,
                receiver: env.ESCROW_ADDRESS,
                value: "0", // Access value from ESDTTransfer or direct EGLD
                gasLimit: env.GAS_LIMIT,
                data: data
            }
        });
        return;
    }

    // --- RETAIL FLOW (V1) ---
    if (!product_id) {
        return res.status(400).json({ error: "Missing product_id" });
    }

    const products = await fetchProducts();
    const product = products.find(p => p.product_id === product_id);

    if (!product) {
        return res.status(404).json({ error: "Product not found or not in showcase" });
    }

    // Construct Transaction Data
    const tokenHex = Buffer.from(product.custom_attributes.token_id).toString("hex");
    const nonceHex = product.custom_attributes.nonce.toString(16).padStart(2, "0");
    const nonceEven = nonceHex.length % 2 !== 0 ? `0${nonceHex}` : nonceHex;
    const quantityHex = "01"; // Default 1

    // "buy@TokenHex@Nonce@Qty"
    const data = `buy@${tokenHex}@${nonceEven}@${quantityHex}`;

    // USE CONFIGURABLE ADDRESS
    const dAppUrl = `https://wallet.multiversx.com/hook/sign?data=${data}&receiver=${env.MARKETPLACE_ADDRESS}`;

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
 */
app.post("/delegate_payment", async (req, res) => {
    const payload = req.body as RelayedPayload;

    // Validate Signature
    const isValid = RelayerService.verifySignature(payload);

    if (!isValid) {
        return res.status(401).json({ error: "Invalid Signature" });
    }

    // Generate Payment Token (Ref ID)
    const paymentToken = `acp_mvx_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    // Store payload persistently
    StorageService.setPayment(paymentToken, {
        token: paymentToken,
        status: "pending",
        ...payload
    });

    res.json({ payment_token: paymentToken });
});

/**
 * 4. Capture (V2)
 * Merchant calls this to trigger the broadcast.
 */
app.post("/capture", async (req, res) => {
    const { payment_token } = req.body;

    const payload = StorageService.payments[payment_token];

    if (!payload) {
        return res.status(404).json({ error: "Invalid payment token" });
    }

    // Broadcast
    const txHash = await RelayerService.broadcastRelayed(payload as unknown as RelayedPayload);

    res.json({
        status: "processing",
        tx_hash: txHash
    });
});

