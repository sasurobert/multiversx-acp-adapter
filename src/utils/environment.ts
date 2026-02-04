import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { logger } from "./logger";

// Load .env file
dotenv.config();

export interface Environment {
    API_URL: string;
    CHAIN_ID: string;
    MARKETPLACE_ADDRESS: string;
    VENDOR_ADDRESS: string;
    ESCROW_ADDRESS: string;
    RELAYER_SECRET_KEY: string;
    VENDOR_SECRET_KEY: string;
    GAS_LIMIT: number;
    SHOWCASE_COLLECTION?: string;
    DEFAULT_TOKEN_ID?: string;
    OPENAI_WEBHOOK_URL?: string;
    OPENAI_WEBHOOK_SECRET?: string;
    ENV: "test" | "dev" | "prod";
    ACP_API_KEY?: string;
    ACP_SIGNING_SECRET?: string;
    SELLER_NAME: string;
    SELLER_URL: string;
    RETURN_POLICY_URL: string;
    STORE_COUNTRY: string;
    ORDER_PERMALINK_BASE_URL: string;
}

const requiredVars = [
    "MARKETPLACE_ADDRESS",
    "VENDOR_ADDRESS",
    "ESCROW_ADDRESS",
    "RELAYER_SECRET_KEY",
    "VENDOR_SECRET_KEY"
];

function validateEnv(): Environment {
    const missing = requiredVars.filter(key => !process.env[key]);
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
    }

    // Load defaults from config.json if Env Vars are missing (backward compatibility, optional)
    // For production readiness, we prefer Env Vars override everything.
    let jsonConfig: Record<string, string | undefined> = {};
    try {
        const configPath = path.join(__dirname, "../config.json");
        if (fs.existsSync(configPath)) {
            const raw = fs.readFileSync(configPath, 'utf-8');
            jsonConfig = JSON.parse(raw);
        }
    } catch {
        logger.warn("Could not load config.json, relying solely on ENV");
    }

    return {
        API_URL: process.env.API_URL || jsonConfig.api_url || "https://devnet-api.multiversx.com",
        CHAIN_ID: process.env.CHAIN_ID || jsonConfig.chain_id || "D",
        MARKETPLACE_ADDRESS: process.env.MARKETPLACE_ADDRESS || jsonConfig.marketplace_address || "",
        VENDOR_ADDRESS: process.env.VENDOR_ADDRESS || jsonConfig.vendor_address || "",
        ESCROW_ADDRESS: process.env.ESCROW_ADDRESS || jsonConfig.escrow_address || "",
        RELAYER_SECRET_KEY: process.env.RELAYER_SECRET_KEY || jsonConfig.relayer_secret_key || "",
        VENDOR_SECRET_KEY: process.env.VENDOR_SECRET_KEY || jsonConfig.vendor_secret_key || "",
        GAS_LIMIT: parseInt(process.env.GAS_LIMIT || jsonConfig.gas_limit || "60000000"),
        SHOWCASE_COLLECTION: process.env.SHOWCASE_COLLECTION || jsonConfig.showcase_collection,
        DEFAULT_TOKEN_ID: process.env.DEFAULT_TOKEN_ID || jsonConfig.default_token_id,
        OPENAI_WEBHOOK_URL: process.env.OPENAI_WEBHOOK_URL || jsonConfig.openai_webhook_url,
        OPENAI_WEBHOOK_SECRET: process.env.OPENAI_WEBHOOK_SECRET || jsonConfig.openai_webhook_secret,
        ENV: (process.env.NODE_ENV as "dev" | "prod" | "test") || "dev",
        ACP_API_KEY: process.env.ACP_API_KEY || jsonConfig.acp_api_key,
        ACP_SIGNING_SECRET: process.env.ACP_SIGNING_SECRET || jsonConfig.acp_signing_secret,
        SELLER_NAME: process.env.SELLER_NAME || jsonConfig.seller_name || "MultiversX Store",
        SELLER_URL: process.env.SELLER_URL || jsonConfig.seller_url || "https://multiversx.com",
        RETURN_POLICY_URL: process.env.RETURN_POLICY_URL || jsonConfig.return_policy_url || "https://multiversx.com/terms",
        STORE_COUNTRY: process.env.STORE_COUNTRY || jsonConfig.store_country || "US",
        ORDER_PERMALINK_BASE_URL: process.env.ORDER_PERMALINK_BASE_URL || jsonConfig.order_permalink_base_url || "https://multiversx.com/orders"
    };
}

export const env = validateEnv();
