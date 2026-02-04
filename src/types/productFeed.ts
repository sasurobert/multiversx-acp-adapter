/**
 * ACP Product Feed Spec Types
 * Based on: https://developers.openai.com/commerce/specs/product-feed
 */

export interface AcpProductFeed {
    item_id: string;
    title: string;
    description: string;
    url: string;
    is_eligible_search: boolean;
    is_eligible_checkout: boolean;
    brand: string;
    price: string;  // "79.99 USD" format
    image_url: string;
    availability: "in_stock" | "out_of_stock" | "pre_order" | "backorder" | "unknown";
    group_id: string;
    listing_has_variations: boolean;
    seller_name: string;
    seller_url: string;
    return_policy: string;
    target_countries: string[];
    store_country: string;
    // Optional fields
    additional_image_urls?: string;
    condition?: string;
    product_category?: string;
    sale_price?: string;
}
