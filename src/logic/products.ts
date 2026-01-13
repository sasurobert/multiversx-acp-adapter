import axios from "axios";
import { config } from "../utils/config";

export interface AcpProduct {
    product_id: string;
    title: string;
    description: string;
    price: {
        amount: string;
        currency: string;
    };
    custom_attributes: {
        token_id: string;
        nonce: number;
        image_url?: string;
    };
}

export async function fetchProducts(): Promise<AcpProduct[]> {
    try {
        const params: any = { size: 10 };
        if (config.showcase_collection) {
            params.collection = config.showcase_collection;
        } else {
            // Fallback: fetch recent NFTs if no collection specified
            // or ensure we get at least something valid
        }

        const url = `${config.api_url}/nfts`;
        const response = await axios.get(url, { params });
        const items = response.data;

        return items.map((item: any) => ({
            product_id: item.identifier,
            title: item.name || item.identifier,
            description: "On-chain Asset",
            price: {
                amount: "0", // ACP requires amount. MVP: 0 means "See wallet" or "Market Rate"
                currency: "EGLD"
            },
            custom_attributes: {
                token_id: item.identifier.split("-").slice(0, 2).join("-"),
                nonce: item.nonce,
                image_url: item.url
            }
        }));
    } catch (error) {
        console.error("Failed to fetch products:", error);
        return [];
    }
}
