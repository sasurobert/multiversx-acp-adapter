import crypto from "crypto";
import axios from "axios";
import { env } from "../utils/environment";
import { WebhookEvent, OrderEventData } from "../types/acp";

export class WebhookService {
    /**
     * Sends a webhook event to OpenAI with HMAC signature
     */
    static async sendWebhook(event: WebhookEvent): Promise<void> {
        // Skip if webhook URL not configured
        if (!env.OPENAI_WEBHOOK_URL) {
            console.warn("⚠️  OPENAI_WEBHOOK_URL not configured, skipping webhook");
            return;
        }

        if (!env.OPENAI_WEBHOOK_SECRET) {
            console.error("❌ OPENAI_WEBHOOK_SECRET not configured, cannot sign webhook");
            return;
        }

        try {
            const payload = JSON.stringify(event);

            // Create HMAC signature
            const signature = crypto
                .createHmac("sha256", env.OPENAI_WEBHOOK_SECRET)
                .update(payload)
                .digest("hex");

            // Send webhook
            await axios.post(env.OPENAI_WEBHOOK_URL, payload, {
                headers: {
                    "Content-Type": "application/json",
                    "X-Merchant-Signature": signature,
                },
                timeout: 5000, // 5 second timeout
            });

            console.log(`✅ Webhook sent: ${event.type} for order ${event.data.order_id}`);
        } catch (error) {
            console.error("❌ Failed to send webhook:", error);
            // Don't throw - webhook failures shouldn't block the main flow
        }
    }

    /**
     * Creates an order.created webhook event
     */
    static createOrderCreatedEvent(orderData: OrderEventData): WebhookEvent {
        return {
            type: "order.created",
            timestamp: new Date().toISOString(),
            data: orderData,
        };
    }

    /**
     * Creates an order.updated webhook event
     */
    static createOrderUpdatedEvent(orderData: OrderEventData): WebhookEvent {
        return {
            type: "order.updated",
            timestamp: new Date().toISOString(),
            data: orderData,
        };
    }
}
