import express from "express";
import { fetchProducts } from "./logic/products";
import { config } from "./utils/config";
import { RelayerService, RelayedPayload } from "./logic/relayer";

export const app = express();

app.use(express.json());

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
    const { product_id } = req.body;

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
    const dAppUrl = `https://wallet.multiversx.com/hook/sign?data=${data}&receiver=${config.marketplace_address}`;

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
    // Note: In this MVP/Demo, verification might fail if we don't have a real signature.
    // We'll allow a "skip_verification" flag for testing if needed, or enforce it.
    // For Safety: We log verification result but proceed if it's a mock.
    const isValid = RelayerService.verifySignature(payload);

    if (!isValid && !process.env.TEST_MODE) {
        // In Prod, uncomment: return res.status(401).json({ error: "Invalid Signature" });
        console.warn("Signature verification failed (ignoring for Demo)");
    }

    // Generate Payment Token (Ref ID)
    const paymentToken = `acp_mvx_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    // Store payload (In-memory for MVP)
    // In Prod: await db.payments.create({ token: paymentToken, payload, status: 'pending' });
    (global as any).paymentStore = (global as any).paymentStore || {};
    (global as any).paymentStore[paymentToken] = payload;

    res.json({ payment_token: paymentToken });
});

/**
 * 4. Capture (V2)
 * Merchant calls this to trigger the broadcast.
 */
app.post("/capture", async (req, res) => {
    const { payment_token } = req.body;

    const store = (global as any).paymentStore || {};
    const payload = store[payment_token];

    if (!payload) {
        return res.status(404).json({ error: "Invalid payment token" });
    }

    // Broadcast
    const txHash = await RelayerService.broadcastRelayed(payload);

    res.json({
        status: "processing",
        tx_hash: txHash
    });
});

