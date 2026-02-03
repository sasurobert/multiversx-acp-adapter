/**
 * OpenAI Agentic Commerce Protocol (ACP) Types
 * Based on: https://developers.openai.com/commerce/specs/checkout
 */

export type CheckoutSessionStatus = 
  | "not_ready_for_payment" 
  | "ready_for_payment" 
  | "completed" 
  | "canceled";

export type MessageType = "info" | "error";

export type MessageCode = 
  | "missing" 
  | "invalid" 
  | "out_of_stock" 
  | "payment_declined" 
  | "requires_sign_in" 
  | "requires_3ds";

export type LinkType = "terms_of_use" | "privacy_policy" | "seller_shop_policies";

export type TotalType = 
  | "items_base_amount" 
  | "items_discount" 
  | "subtotal" 
  | "discount" 
  | "fulfillment" 
  | "tax" 
  | "fee" 
  | "total";

export type FulfillmentType = "shipping" | "digital";

export type PaymentProvider = "stripe" | "adyen" | "braintree" | "multiversx";

export type OrderStatus = 
  | "created" 
  | "manual_review" 
  | "confirmed" 
  | "canceled" 
  | "shipped" 
  | "fulfilled";

export type WebhookEventType = "order.created" | "order.updated";

export interface Item {
  id: string;
  quantity: number;
  variant_id?: string;
}

export interface LineItem {
  id: string;
  item: Item;
  base_amount: number;
  discount: number;
  subtotal: number;
  tax: number;
  total: number;
}

export interface Total {
  type: TotalType;
  display_text: string;
  amount: number;
}

export interface Message {
  type: MessageType;
  code?: MessageCode;
  path?: string;
  content_type: "plain" | "markdown";
  content: string;
}

export interface Link {
  type: LinkType;
  url: string;
}

export interface Address {
  name: string;
  line_one: string;
  line_two?: string;
  city: string;
  state: string;
  country: string;
  postal_code: string;
  phone_number?: string;
}

export interface FulfillmentOption {
  type: FulfillmentType;
  id: string;
  title: string;
  subtitle?: string;
  carrier?: string;
  earliest_delivery_time?: string;
  latest_delivery_time?: string;
  subtotal: number;
  tax: number;
  total: number;
}

export interface PaymentProviderInfo {
  provider: PaymentProvider;
  supported_payment_methods: string[];
}

export interface PaymentData {
  token: string;
  provider: PaymentProvider;
  billing_address?: Address;
}

export interface Buyer {
  name: string;
  email: string;
  phone_number?: string;
}

export interface CheckoutSession {
  id: string;
  status: CheckoutSessionStatus;
  currency: string;
  line_items: LineItem[];
  totals: Total[];
  fulfillment_options?: FulfillmentOption[];
  fulfillment_address?: Address;
  fulfillment_option_id?: string;
  payment_provider?: PaymentProviderInfo;
  buyer?: Buyer;
  messages?: Message[];
  links?: Link[];
  order_id?: string;
}

// Request/Response types
export interface CreateCheckoutSessionRequest {
  items: Item[];
  fulfillment_address?: Address;
  buyer?: Buyer;
}

export interface UpdateCheckoutSessionRequest {
  items?: Item[];
  fulfillment_address?: Address;
  fulfillment_option_id?: string;
}

export interface CompleteCheckoutSessionRequest {
  buyer: Buyer;
  payment_data: PaymentData;
}

// Webhook types
export interface OrderEventData {
  type: "order";
  order_id: string;
  checkout_session_id: string;
  status: OrderStatus;
  total_amount: number;
  currency: string;
  line_items: LineItem[];
  fulfillment_address?: Address;
  buyer: Buyer;
  created_at: string;
  updated_at: string;
}

export interface WebhookEvent {
  type: WebhookEventType;
  timestamp: string;
  data: OrderEventData;
}

// Error types
export interface AcpError {
  code: string;
  message: string;
  path?: string;
}
