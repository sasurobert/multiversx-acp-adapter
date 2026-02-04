import axios from "axios";
import { env } from "../utils/environment";
import { AcpProductFeed } from "../types/productFeed";

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

/**
 * Fetches products from MultiversX and maps them to the ACP Product Feed Spec.
 */
export async function fetchAcpProducts(): Promise<AcpProductFeed[]> {
    try {
        const params: any = { size: 10 };
        if (env.SHOWCASE_COLLECTION) {
            params.collection = env.SHOWCASE_COLLECTION;
        }

        const url = `${env.API_URL}/nfts`;
        const response = await axios.get(url, { params });
        const items = response.data;

        return items.map((item: any) => {
            const tokenId = item.identifier.split("-").slice(0, 2).join("-");
            const priceValue = item.price || "0";

            return {
                item_id: item.identifier,
                title: item.name || item.identifier,
                description: item.attributes?.description || "MultiversX On-chain Asset",
                url: `${env.SELLER_URL}/product/${item.identifier}`,
                is_eligible_search: true,
                is_eligible_checkout: true,
                brand: env.SELLER_NAME,
                price: `${priceValue} EGLD`,
                image_url: item.url || item.media?.[0]?.url || "",
                availability: "in_stock" as const,
                group_id: tokenId,
                listing_has_variations: item.nonce > 1,
                seller_name: env.SELLER_NAME,
                seller_url: env.SELLER_URL,
                return_policy: env.RETURN_POLICY_URL,
                target_countries: [env.STORE_COUNTRY],
                store_country: env.STORE_COUNTRY,
                additional_image_urls: item.media?.slice(1).map((m: any) => m.url).join(","),
                condition: "new",
            };
        });
    } catch (error) {
        console.error("Failed to fetch products:", error);
        return [];
    }
}

/**
 * Legacy fetch for backward compatibility. Mapped to ACP spec.
 */
export async function fetchProducts(): Promise<AcpProduct[]> {
    const acpProducts = await fetchAcpProducts();
    return acpProducts.map(p => ({
        product_id: p.item_id,
        title: p.title,
        description: p.description,
        price: {
            amount: p.price.split(" ")[0],
            currency: p.price.split(" ")[1]
        },
        custom_attributes: {
            token_id: p.group_id,
            nonce: parseInt(p.item_id.split("-").pop() || "0"),
            image_url: p.image_url
        }
    }));
}
