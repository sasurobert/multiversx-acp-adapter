import crypto from "crypto";
import axios from "axios";
import { env } from "../utils/environment";
import { logger } from "../utils/logger";
import { WebhookEvent, OrderEventData } from "../types/acp";

export class WebhookService {
    /**
     * Sends a webhook event to OpenAI with HMAC signature
     */
    static async sendWebhook(event: WebhookEvent, retries = 3): Promise<void> {
        // Skip if webhook URL not configured
        if (!env.OPENAI_WEBHOOK_URL) {
            logger.warn("⚠️  OPENAI_WEBHOOK_URL not configured, skipping webhook");
            return;
        }

        if (!env.OPENAI_WEBHOOK_SECRET) {
            logger.error("❌ OPENAI_WEBHOOK_SECRET not configured, cannot sign webhook");
            return;
        }

        const payload = JSON.stringify(event);

        // Create HMAC signature
        const signature = crypto
            .createHmac("sha256", env.OPENAI_WEBHOOK_SECRET)
            .update(payload)
            .digest("hex");

        // ACP spec: Merchant_Name-Signature
        const merchantName = env.SELLER_NAME.replace(/\s+/g, "_");
        const signatureHeader = `${merchantName}-Signature`;

        let attempt = 0;
        while (attempt < retries) {
            try {
                // Send webhook
                await axios.post(env.OPENAI_WEBHOOK_URL, payload, {
                    headers: {
                        "Content-Type": "application/json",
                        [signatureHeader]: signature,
                    },
                    timeout: 5000, // 5 second timeout
                });

                logger.info({ eventType: event.type, orderId: event.data.order_id }, "✅ Webhook sent");
                return;
            } catch (error) {
                attempt++;
                if (attempt >= retries) {
                    logger.error({ error, attempt }, "❌ Failed to send webhook after max retries");
                } else {
                    const delay = Math.pow(2, attempt) * 1000;
                    logger.warn({ attempt, delay }, "⚠️ Webhook failed, retrying...");
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
    }

    /**
     * Creates an order_created webhook event
     */
    static createOrderCreatedEvent(orderData: OrderEventData): WebhookEvent {
        return {
            type: "order_created",
            timestamp: new Date().toISOString(),
            data: orderData,
        };
    }

    /**
     * Creates an order_updated webhook event
     */
    static createOrderUpdatedEvent(orderData: OrderEventData): WebhookEvent {
        return {
            type: "order_updated",
            timestamp: new Date().toISOString(),
            data: orderData,
        };
    }
}
