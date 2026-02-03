import { Router, Request, Response } from "express";
import { randomUUID } from "crypto";
import { StorageService } from "../logic/storage";
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
 * In a real implementation, you'd fetch product prices from a database
 */
function createLineItems(items: { id: string; quantity: number }[]): LineItem[] {
    return items.map((item, index) => {
        // Mock pricing - in production, fetch from product catalog
        const baseAmount = 1000; // 10.00 in cents
        const discount = 0;
        const subtotal = baseAmount * item.quantity - discount;
        const tax = Math.floor(subtotal * 0.1); // 10% tax
        const total = subtotal + tax;

        return {
            id: `line_item_${index}`,
            item: {
                id: item.id,
                quantity: item.quantity,
            },
            base_amount: baseAmount * item.quantity,
            discount,
            subtotal,
            tax,
            total,
        };
    });
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
                code: "invalid_request",
                message: "items field is required and must not be empty",
            };
            return res.status(400).json(error);
        }

        const sessionId = `checkout_session_${randomUUID()}`;
        const lineItems = createLineItems(body.items);
        const totals = calculateTotals(lineItems);

        // Determine status based on whether we have fulfillment address
        const status = body.fulfillment_address ? "ready_for_payment" : "not_ready_for_payment";

        const session: CheckoutSession = {
            id: sessionId,
            status,
            currency: "usd", // Default to USD, could be configurable
            line_items: lineItems,
            totals,
            fulfillment_address: body.fulfillment_address,
            payment_provider: {
                provider: "multiversx",
                supported_payment_methods: ["crypto_wallet"],
            },
            buyer: body.buyer,
            links: [
                {
                    type: "terms_of_use",
                    url: "https://multiversx.com/terms",
                },
            ],
        };

        StorageService.setSession(sessionId, session);

        return res.status(201).json(session);
    } catch (error) {
        console.error("Error creating checkout session:", error);
        const acpError: AcpError = {
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
            const error: AcpError = { code: "invalid_request", message: "Invalid session ID" };
            return res.status(400).json(error);
        }

        const body = req.body as UpdateCheckoutSessionRequest;

        const session = StorageService.getSession<CheckoutSession>(id);
        if (!session) {
            const error: AcpError = {
                code: "invalid_request",
                message: "Checkout session not found",
            };
            return res.status(404).json(error);
        }

        // Update items if provided
        if (body.items) {
            session.line_items = createLineItems(body.items);
            session.totals = calculateTotals(session.line_items);
        }

        // Update fulfillment address if provided
        if (body.fulfillment_address) {
            session.fulfillment_address = body.fulfillment_address;
        }

        // Update fulfillment option if provided
        if (body.fulfillment_option_id) {
            session.fulfillment_option_id = body.fulfillment_option_id;
        }

        // Update status based on whether we have required info
        if (session.fulfillment_address && session.line_items.length > 0) {
            session.status = "ready_for_payment";
        }

        StorageService.setSession(id, session);

        return res.status(201).json(session);
    } catch (error) {
        console.error("Error updating checkout session:", error);
        const acpError: AcpError = {
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
            const error: AcpError = { code: "invalid_request", message: "Invalid session ID" };
            return res.status(400).json(error);
        }

        const session = StorageService.getSession<CheckoutSession>(id);
        if (!session) {
            const error: AcpError = {
                code: "invalid_request",
                message: "Checkout session not found",
            };
            return res.status(404).json(error);
        }

        return res.status(200).json(session);
    } catch (error) {
        console.error("Error retrieving checkout session:", error);
        const acpError: AcpError = {
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
            const error: AcpError = { code: "invalid_request", message: "Invalid session ID" };
            return res.status(400).json(error);
        }

        const body = req.body as CompleteCheckoutSessionRequest;

        const session = StorageService.getSession<CheckoutSession>(id);
        if (!session) {
            const error: AcpError = {
                code: "invalid_request",
                message: "Checkout session not found",
            };
            return res.status(404).json(error);
        }

        if (session.status === "completed") {
            const error: AcpError = {
                code: "invalid_request",
                message: "Checkout session already completed",
            };
            return res.status(400).json(error);
        }

        if (session.status === "canceled") {
            const error: AcpError = {
                code: "invalid_request",
                message: "Cannot complete a canceled checkout session",
            };
            return res.status(400).json(error);
        }

        if (!body.buyer || !body.payment_data) {
            const error: AcpError = {
                code: "invalid_request",
                message: "buyer and payment_data are required",
            };
            return res.status(400).json(error);
        }

        // Update session with buyer and mark as completed
        session.buyer = body.buyer;
        session.status = "completed";
        session.order_id = `order_${randomUUID()}`;

        StorageService.setSession(id, session);

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
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        await WebhookService.sendWebhook(WebhookService.createOrderCreatedEvent(orderData));

        return res.status(200).json(session);
    } catch (error) {
        console.error("Error completing checkout session:", error);
        const acpError: AcpError = {
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
            const error: AcpError = { code: "invalid_request", message: "Invalid session ID" };
            return res.status(400).json(error);
        }

        const session = StorageService.getSession<CheckoutSession>(id);
        if (!session) {
            const error: AcpError = {
                code: "invalid_request",
                message: "Checkout session not found",
            };
            return res.status(404).json(error);
        }

        if (session.status === "completed" || session.status === "canceled") {
            const error: AcpError = {
                code: "invalid_request",
                message: "Cannot cancel a completed or already canceled session",
            };
            return res.status(405).json(error);
        }

        session.status = "canceled";
        StorageService.setSession(id, session);

        return res.status(200).json(session);
    } catch (error) {
        console.error("Error canceling checkout session:", error);
        const acpError: AcpError = {
            code: "processing_error",
            message: error instanceof Error ? error.message : "Internal server error",
        };
        return res.status(500).json(acpError);
    }
});
