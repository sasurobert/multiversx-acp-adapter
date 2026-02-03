import dotenv from "dotenv";
import fs from "fs";
import path from "path";

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
    ENV: "test" | "dev" | "prod";
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
    let jsonConfig: any = {};
    try {
        const configPath = path.join(__dirname, "../config.json");
        if (fs.existsSync(configPath)) {
            const raw = fs.readFileSync(configPath, 'utf-8');
            jsonConfig = JSON.parse(raw);
        }
    } catch (e) {
        console.warn("Could not load config.json, relying solely on ENV");
    }

    return {
        API_URL: process.env.API_URL || jsonConfig.api_url || "https://devnet-api.multiversx.com",
        CHAIN_ID: process.env.CHAIN_ID || jsonConfig.chain_id || "D",
        MARKETPLACE_ADDRESS: process.env.MARKETPLACE_ADDRESS || jsonConfig.marketplace_address || "",
        VENDOR_ADDRESS: process.env.VENDOR_ADDRESS || "",
        ESCROW_ADDRESS: process.env.ESCROW_ADDRESS || "",
        RELAYER_SECRET_KEY: process.env.RELAYER_SECRET_KEY || "",
        VENDOR_SECRET_KEY: process.env.VENDOR_SECRET_KEY || "",
        GAS_LIMIT: parseInt(process.env.GAS_LIMIT || jsonConfig.gas_limit || "60000000"),
        SHOWCASE_COLLECTION: process.env.SHOWCASE_COLLECTION || jsonConfig.showcase_collection,
        DEFAULT_TOKEN_ID: process.env.DEFAULT_TOKEN_ID || jsonConfig.default_token_id,
        ENV: (process.env.NODE_ENV as any) || "dev"
    };
}

export const env = validateEnv();
