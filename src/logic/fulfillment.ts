import { FulfillmentOption, Address } from "../types/acp";

export class FulfillmentService {
    /**
     * Get available fulfillment options based on address
     */
    static getOptions(address?: Address): FulfillmentOption[] {
        // For digital/NFT products, return digital fulfillment
        const digitalOption: FulfillmentOption = {
            type: "digital",
            id: "digital_instant",
            title: "Instant Delivery",
            subtitle: "NFT will be transferred to your wallet immediately",
            subtotal: 0,
            tax: 0,
            total: 0,
        };

        if (!address) {
            return [digitalOption];
        }

        // If address provided, also offer shipping for physical merch (Mock logic)
        const standardShipping: FulfillmentOption = {
            type: "shipping",
            id: "shipping_standard",
            title: "Standard Shipping",
            subtitle: "Arrives in 5-7 business days",
            carrier: "USPS",
            earliest_delivery_time: FulfillmentService.addDays(5),
            latest_delivery_time: FulfillmentService.addDays(7),
            subtotal: 500,
            tax: 0,
            total: 500,
        };

        const expressShipping: FulfillmentOption = {
            type: "shipping",
            id: "shipping_express",
            title: "Express Shipping",
            subtitle: "Arrives in 2-3 business days",
            carrier: "FedEx",
            earliest_delivery_time: FulfillmentService.addDays(2),
            latest_delivery_time: FulfillmentService.addDays(3),
            subtotal: 1500,
            tax: 0,
            total: 1500,
        };

        return [digitalOption, standardShipping, expressShipping];
    }

    static getDefaultOptionId(options: FulfillmentOption[]): string {
        return options[0]?.id || "";
    }

    private static addDays(days: number): string {
        const date = new Date();
        date.setDate(date.getDate() + days);
        return date.toISOString();
    }
}
