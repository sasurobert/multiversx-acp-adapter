import express from "express";

export const app = express();

app.use(express.json());

// --- Mock Data (To be replaced with shared search logic) ---
const MOCK_PRODUCTS = [
    {
        product_id: "EGLD-123-01",
        title: "Test NFT",
        description: "A great NFT",
        price: { amount: "100", currency: "USDC" },
        custom_attributes: {
            token_id: "EGLD-123",
            nonce: 1
        }
    }
];

/**
 * 1. Product Feed Endpoint
 * GET /.well-known/acp/products.json
 */
app.get("/.well-known/acp/products.json", (req, res) => {
    res.json({ products: MOCK_PRODUCTS });
});

/**
 * 2. Checkout Endpoint
 * POST /checkout
 */
app.post("/checkout", (req, res) => {
    const { product_id } = req.body;

    if (!product_id) {
        return res.status(400).json({ error: "Missing product_id" });
    }

    const product = MOCK_PRODUCTS.find(p => p.product_id === product_id);
    if (!product) {
        return res.status(404).json({ error: "Product not found" });
    }

    // Construct Transaction Data (Mocking "buy" call)
    // In production, use the Configurable Checkout Logic from UCP
    const tokenHex = Buffer.from(product.custom_attributes.token_id).toString("hex");
    const nonceHex = product.custom_attributes.nonce.toString(16).padStart(2, "0");
    const nonceEven = nonceHex.length % 2 !== 0 ? `0${nonceHex}` : nonceHex;
    const quantityHex = "01"; // Default 1

    // "buy@TokenHex@Nonce@Qty"
    const data = `buy@${tokenHex}@${nonceEven}@${quantityHex}`;

    const dAppUrl = `https://wallet.multiversx.com/hook/sign?data=${data}&receiver=erd1...marketplace`;

    // Return ACP-compliant "Action"
    res.json({
        status: "requires_action",
        next_action: {
            type: "use_dapp_wallet",
            dapp_url: dAppUrl
        }
    });
});
