import fs from "fs";
import path from "path";

export interface Config {
    api_url: string;
    marketplace_address: string;
    default_token_id?: string;
    showcase_collection?: string;
    escrow_address?: string;
    chain_id: string;
    gas_limit: number;
}

const configPath = path.join(__dirname, "../config.json");
const rawConfig = fs.readFileSync(configPath, "utf-8");
const jsonConfig = JSON.parse(rawConfig);

export const config: Config = {
    ...jsonConfig,
    chain_id: process.env.CHAIN_ID || jsonConfig.chain_id || "D",
    gas_limit: process.env.GAS_LIMIT ? parseInt(process.env.GAS_LIMIT) : (jsonConfig.gas_limit || 60000000)
};
