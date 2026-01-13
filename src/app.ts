import express from "express";
import { fetchProducts } from "./logic/products";
import { config } from "./utils/config";

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
