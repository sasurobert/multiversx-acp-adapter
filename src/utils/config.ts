import fs from "fs";
import path from "path";

export interface Config {
    api_url: string;
    marketplace_address: string;
    default_token_id?: string;
    showcase_collection?: string;
    escrow_address?: string;
}

const configPath = path.join(__dirname, "../config.json");
const rawConfig = fs.readFileSync(configPath, "utf-8");
export const config: Config = JSON.parse(rawConfig);
