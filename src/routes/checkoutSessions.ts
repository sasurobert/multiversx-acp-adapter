import { Router, Request, Response } from "express";
import { randomUUID } from "crypto";
import { StorageService } from "../logic/storage";
import { logger } from "../utils/logger";
import { WebhookService } from "../logic/webhooks";
import {
    CheckoutSession,
    CreateCheckoutSessionRequest,
    UpdateCheckoutSessionRequest,
    CompleteCheckoutSessionRequest,
    LineItem,
    Total,
    OrderEventData,
    AcpError,
} from "../types/acp";
import { FulfillmentService } from "../logic/fulfillment";
import { MessageService } from "../logic/messages";
import { env } from "../utils/environment";
import { getProductById, parsePrice } from "../logic/products";


export const checkoutSessionsRouter = Router();

/**
 * Helper: Calculate totals from line items
 */
function calculateTotals(lineItems: LineItem[]): Total[] {
    const itemsBaseAmount = lineItems.reduce((sum, item) => sum + item.base_amount, 0);
    const itemsDiscount = lineItems.reduce((sum, item) => sum + item.discount, 0);
    const subtotal = itemsBaseAmount - itemsDiscount;
    const tax = lineItems.reduce((sum, item) => sum + item.tax, 0);
    const total = lineItems.reduce((sum, item) => sum + item.total, 0);

    return [
        { type: "items_base_amount", display_text: "Item(s) total", amount: itemsBaseAmount },
        { type: "subtotal", display_text: "Subtotal", amount: subtotal },
        { type: "tax", display_text: "Tax", amount: tax },
        { type: "total", display_text: "Total", amount: total },
    ];
}

/**
 * Helper: Create line items from request items
 * Fetches actual product prices from the product catalog
 */
async function createLineItems(items: { id: string; quantity: number }[]): Promise<LineItem[]> {
    const lineItems: LineItem[] = [];

    for (const [index, item] of items.entries()) {
        const product = await getProductById(item.id);

        // Get price from product catalog, fallback to default if not found
        let baseAmount: number;
        if (product) {
            baseAmount = parsePrice(product.price);
        } else {
            // Fallback for unknown products (e.g., in tests or when catalog unavailable)
            logger.warn({ productId: item.id }, "Product not found in catalog, using default price");
            baseAmount = 1000; // 10.00 in cents
        }

        const itemTotal = baseAmount * item.quantity;
        const discount = 0;
        const subtotal = itemTotal - discount;
        const tax = Math.floor(subtotal * 0.1); // 10% tax
        const total = subtotal + tax;

        lineItems.push({
            id: `line_item_${index}`,
            item: {
                id: item.id,
                quantity: item.quantity,
            },
            base_amount: itemTotal,
            discount,
            subtotal,
            tax,
            total,
        });
    }

    return lineItems;
}


/**
 * POST /checkout_sessions
 * Create a new checkout session
 */
checkoutSessionsRouter.post("/", async (req: Request, res: Response) => {
    try {
        const body = req.body as CreateCheckoutSessionRequest;

        if (!body.items || body.items.length === 0) {
            const error: AcpError = {
                type: "invalid_request",
                code: "invalid_request",
                message: "items field is required and must not be empty",
                param: "$.items",
            };
            return res.status(400).json(error);
        }

        const sessionId = `checkout_session_${randomUUID()}`;
        const lineItems = await createLineItems(body.items);
        const totals = calculateTotals(lineItems);

        // Determine status based on whether we have fulfillment address
        const status = body.fulfillment_address ? "ready_for_payment" : "not_ready_for_payment";

        // Get Fulfillment Options
        const fulfillmentOptions = FulfillmentService.getOptions(body.fulfillment_address);
        const defaultFulfillmentId = FulfillmentService.getDefaultOptionId(fulfillmentOptions);

        const session: CheckoutSession = {
            id: sessionId,
            status,
            currency: "usd", // Default to USD, could be configurable
            line_items: lineItems,
            totals,
            fulfillment_address: body.fulfillment_address,
            fulfillment_options: fulfillmentOptions,
            fulfillment_option_id: defaultFulfillmentId,
            payment_provider: {
                provider: "multiversx",
                supported_payment_methods: ["crypto_wallet"],
            },
            buyer: body.buyer,
            messages: [],
            links: [
                {
                    type: "terms_of_use",
                    url: env.RETURN_POLICY_URL, // Using configured policy URL
                },
                {
                    type: "privacy_policy",
                    url: env.RETURN_POLICY_URL, // Or a separate one if available
                }
            ],
        };

        // Add initial validation messages
        if (!session.fulfillment_address) {
            session.messages?.push(MessageService.createFieldErrorMessage("fulfillment_address", "Fulfillment address is required to proceed."));
        } else if (session.status === "ready_for_payment") {
            session.messages?.push(MessageService.createInfoMessage("all_set", "Great! Your order is ready for payment."));
        }

        StorageService.setSession(sessionId, {
            id: sessionId,
            status: session.status,
            data: session
        });

        return res.status(201).json(session);
    } catch (error) {
        logger.error({ error }, "Error creating checkout session");
        const acpError: AcpError = {
            type: "processing_error",
            code: "processing_error",
            message: error instanceof Error ? error.message : "Internal server error",
        };
        return res.status(500).json(acpError);
    }
});

/**
 * POST /checkout_sessions/:id
 * Update an existing checkout session
 */
checkoutSessionsRouter.post("/:id", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        if (Array.isArray(id)) {
            const error: AcpError = {
                type: "invalid_request",
                code: "invalid_request",
                message: "Invalid session ID"
            };
            return res.status(400).json(error);
        }

        const body = req.body as UpdateCheckoutSessionRequest;

        const sessionData = StorageService.getSession(id);
        if (!sessionData) {
            const error: AcpError = {
                type: "invalid_request",
                code: "invalid_request",
                message: "Checkout session not found",
            };
            return res.status(404).json(error);
        }
        const session = sessionData.data;

        // Update items if provided
        if (body.items) {
            session.line_items = await createLineItems(body.items);
            session.totals = calculateTotals(session.line_items);
        }

        // Update fulfillment address if provided
        if (body.fulfillment_address) {
            session.fulfillment_address = body.fulfillment_address;
            session.fulfillment_options = FulfillmentService.getOptions(body.fulfillment_address);
            session.fulfillment_option_id = FulfillmentService.getDefaultOptionId(session.fulfillment_options);
        }

        // Update fulfillment option if provided
        if (body.fulfillment_option_id) {
            session.fulfillment_option_id = body.fulfillment_option_id;
        }

        // Update status and add messages based on whether we have required info
        session.messages = [];
        if (session.fulfillment_address && session.line_items.length > 0) {
            session.status = "ready_for_payment";
            session.messages.push(MessageService.createInfoMessage("all_set", "Great! Your order is ready for payment."));
        } else {
            session.status = "not_ready_for_payment";
            if (!session.fulfillment_address) {
                session.messages.push(MessageService.createFieldErrorMessage("fulfillment_address", "Fulfillment address is required to proceed."));
            }
        }

        StorageService.setSession(id, {
            id,
            status: session.status,
            data: session
        });

        // Send order.updated webhook if status became ready_for_payment
        if (session.status === "ready_for_payment") {
            const orderData: OrderEventData = {
                type: "order",
                order_id: session.order_id || "",
                checkout_session_id: session.id,
                status: "updated",
                total_amount: session.totals.find((t: Total) => t.type === "total")?.amount || 0,
                currency: session.currency,
                line_items: session.line_items,
                fulfillment_address: session.fulfillment_address,
                buyer: session.buyer || { email: "unknown@example.com", name: "Unknown" },
                permalink_url: session.order?.permalink_url || "",
                refunds: [],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            WebhookService.sendWebhook(WebhookService.createOrderUpdatedEvent(orderData)).catch((e) => logger.error({ error: e }, "Failed to send update webhook"));
        }

        return res.status(201).json(session);
    } catch (error) {
        logger.error({ error }, "Error updating checkout session");
        const acpError: AcpError = {
            type: "processing_error",
            code: "processing_error",
            message: error instanceof Error ? error.message : "Internal server error",
        };
        return res.status(500).json(acpError);
    }
});

/**
 * GET /checkout_sessions/:id
 * Retrieve a checkout session
 */
checkoutSessionsRouter.get("/:id", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        if (Array.isArray(id)) {
            const error: AcpError = {
                type: "invalid_request",
                code: "invalid_request",
                message: "Invalid session ID"
            };
            return res.status(400).json(error);
        }

        const sessionData = StorageService.getSession(id);
        if (!sessionData) {
            const error: AcpError = {
                type: "invalid_request",
                code: "invalid_request",
                message: "Checkout session not found",
            };
            return res.status(404).json(error);
        }

        return res.status(200).json(sessionData.data);
    } catch (error) {
        logger.error({ error }, "Error retrieving checkout session");
        const acpError: AcpError = {
            type: "processing_error",
            code: "processing_error",
            message: error instanceof Error ? error.message : "Internal server error",
        };
        return res.status(500).json(acpError);
    }
});

/**
 * POST /checkout_sessions/:id/complete
 * Complete a checkout session and create an order
 */
checkoutSessionsRouter.post("/:id/complete", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        if (Array.isArray(id)) {
            const error: AcpError = {
                type: "invalid_request",
                code: "invalid_request",
                message: "Invalid session ID"
            };
            return res.status(400).json(error);
        }

        const body = req.body as CompleteCheckoutSessionRequest;

        const sessionData = StorageService.getSession<CheckoutSession>(id);
        if (!sessionData) {
            const error: AcpError = {
                type: "invalid_request",
                code: "invalid_request",
                message: "Checkout session not found",
            };
            return res.status(404).json(error);
        }
        const session = sessionData.data;

        if (session.status === "completed") {
            const error: AcpError = {
                type: "invalid_request",
                code: "invalid_request",
                message: "Checkout session already completed",
            };
            return res.status(400).json(error);
        }

        if (session.status === "canceled") {
            const error: AcpError = {
                type: "invalid_request",
                code: "invalid_request",
                message: "Cannot complete a canceled checkout session",
            };
            return res.status(400).json(error);
        }

        if (!body.buyer || !body.payment_data) {
            const error: AcpError = {
                type: "invalid_request",
                code: "invalid_request",
                message: "buyer and payment_data are required",
            };
            return res.status(400).json(error);
        }

        // Update session with buyer and mark as completed
        session.buyer = body.buyer;
        session.status = "completed";
        const orderId = `order_${randomUUID()}`;
        session.order_id = orderId;
        session.order = {
            id: orderId,
            checkout_session_id: session.id,
            permalink_url: `${env.ORDER_PERMALINK_BASE_URL}/${orderId}`,
        };

        StorageService.setSession(id, {
            id,
            status: session.status,
            data: session
        });

        // Send order.created webhook
        const orderData: OrderEventData = {
            type: "order",
            order_id: session.order_id,
            checkout_session_id: session.id,
            status: "created",
            total_amount: session.totals.find((t: Total) => t.type === "total")?.amount || 0,
            currency: session.currency,
            line_items: session.line_items,
            fulfillment_address: session.fulfillment_address,
            buyer: session.buyer,
            permalink_url: session.order.permalink_url,
            refunds: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        await WebhookService.sendWebhook(WebhookService.createOrderCreatedEvent(orderData));

        return res.status(201).json(session);
    } catch (error) {
        logger.error({ error }, "Error completing checkout session");
        const acpError: AcpError = {
            type: "processing_error",
            code: "processing_error",
            message: error instanceof Error ? error.message : "Internal server error",
        };
        return res.status(500).json(acpError);
    }
});

/**
 * POST /checkout_sessions/:id/cancel
 * Cancel a checkout session
 */
checkoutSessionsRouter.post("/:id/cancel", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        if (Array.isArray(id)) {
            const error: AcpError = {
                type: "invalid_request",
                code: "invalid_request",
                message: "Invalid session ID"
            };
            return res.status(400).json(error);
        }

        const sessionData = StorageService.getSession<CheckoutSession>(id);
        if (!sessionData) {
            const error: AcpError = {
                type: "invalid_request",
                code: "invalid_request",
                message: "Checkout session not found",
            };
            return res.status(404).json(error);
        }
        const session = sessionData.data;

        if (session.status === "completed" || session.status === "canceled") {
            const error: AcpError = {
                type: "invalid_request",
                code: "invalid_request",
                message: "Cannot cancel a completed or already canceled session",
            };
            return res.status(405).json(error);
        }

        session.status = "canceled";
        StorageService.setSession(id, {
            id,
            status: session.status,
            data: session
        });

        return res.status(200).json(session);
    } catch (error) {
        logger.error({ error }, "Error canceling checkout session");
        const acpError: AcpError = {
            type: "processing_error",
            code: "processing_error",
            message: error instanceof Error ? error.message : "Internal server error",
        };
        return res.status(500).json(acpError);
    }
});
