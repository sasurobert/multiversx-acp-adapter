Agentic Commerce Protocol
An open standard that enables a conversation between buyers, their AI agents, and businesses to complete a purchase

Overview

OpenAI and Stripe built the Agentic Commerce Protocol to be:

Powerful – connect with millions of users of AI products and build direct customer relationships
Easy to adopt – easily connects with your current commerce systems so you can start accepting orders with minimal effort
Flexible – works across payment processors, platforms, purchase types and business types; stewarded by OpenAI and Stripe with calls for more participants
Secure – protects payment information, maintains compliance, and provides merchants the signals they need to accept or decline orders
It also allows merchants to keep their customer relationship–merchants own their direct customer relationship throughout the purchase flow:

Customers buy from merchants directly
Payment flows directly to the merchant
Merchants decide whether to accept or decline an order
Merchants handle the full post-purchase experience
The Agentic Commerce Protocol is open source and community-designed under Apache 2.0 license. Businesses can implement the specification to transact with any AI agent and payment processor.

You can learn more about the Agentic Commerce Protocol at agenticcommerce.dev and on GitHub.

The first product experience built on the Agentic Commerce Protocol is Instant Checkout in ChatGPT. To try it out yourself, try buying from US Etsy sellers in ChatGPT.

To build your own Instant Checkout integration, refer to the section below.

Instant Checkout

The Agentic Commerce Protocol powers Instant Checkout–enabling purchases through ChatGPT.

Instant Checkout lets users buy directly from merchants through ChatGPT, and allows merchants to accept orders from a new channel while keeping their existing order and payment systems.

For users	For merchants
Find and buy anything using ChatGPT as a personal shopping assistant with trusted, fast recommendations.	Reach buyers in the moment, boost conversion, and keep your customer.
ChatGPT mobile commerce experience

Instant Checkout works across:

Platforms: web, iOS and Android
Payment methods: All major card brands, Apple Pay, Google Pay, Link by Stripe and more coming soon
Merchants who want to enable Instant Checkout should implement the Agentic Commerce Protocol and provide OpenAI with a product feed through the Product Feed Spec.

Apply to build

Building with the Agentic Commerce Protocol is open to all. Instant Checkout in ChatGPT is currently available to approved partners. To make your products available for Instant Checkout through ChatGPT, please do the following:

Apply to participate in Instant Checkout.
Share your product feed according to our Product Feed Spec in order to provide ChatGPT with accurate, up-to-date information about your products.
Build your Agentic Checkout API according to the Agentic Checkout Spec. This involves: a. Implementing the required REST endpoints b. Implementing webhooks to notify OpenAI of order events c. Returning rich checkout state on every response
Build your payments integration. Use a trusted payment service provider (PSP) that is compliant with the Delegated Payment Spec in order to securely transmit and charge payment credentials. Stripe’s Shared Payment Token is the first Delegated Payment Spec-compatible implementation with more PSPs coming soon. If you’re a PSP or a PCI DSS level 1 merchant with your own vault, learn how to build a direct integration with OpenAI.
Certify with OpenAI and move to production. To ensure products, payments and orders are all working correctly, work with OpenAI to pass conformance checks and receive production access.
OpenAI plans to onboard new partners on a rolling basis, beginning in the U.S. If you’re an Etsy or Shopify merchant, you do not need to apply or build an integration as you are already eligibleKey concepts
Understand the concepts of the Agentic Commerce Protocol

Building with the Agentic Commerce Protocol is open to all. Instant Checkout in ChatGPT is currently available to approved partners. To apply to participate in Instant Checkout, fill out this form here.
Supporting Instant Checkout in ChatGPT requires a merchant to implement three flows.

Sharing a product feed

The Product Feed Spec defines how merchants share structured product data with OpenAI so ChatGPT can accurately surface their products in search and shopping experiences.

Merchants provide a secure, regularly refreshed feed (CSV or JSON) containing key details such as identifiers, descriptions, pricing, inventory, media, and fulfillment options.
Required fields ensure correct display of price and availability, while recommended attributes—like rich media, reviews, and performance signals—improve ranking, relevance, and user trust.
Integration involves sending an initial sample feed for validation, and daily snapshots.
Handling orders and checkout

The Agentic Checkout Spec enables ChatGPT to act as the customer’s AI agent and renders a checkout experience embedded in ChatGPT’s UI.

ChatGPT collects buyer, fulfillment, and payment information from the user.
ChatGPT calls the merchant’s Agentic Commerce Protocol endpoints to create or update a checkout session, and securely share information.
The merchant performs validation, determines fulfillment options, calculates and charges sales tax, , analyzes payment and risk signals on their own stack, and charges the payment method with their existing payment processor. The merchant accepts or declines the order, and returns this state to ChatGPT.
ChatGPT reflects states and shows the order confirmation (or decline) message to the user.
The checkout session is rendered in the OpenAI UI, but the actual checkout state and payment processing occurs on the merchant’s systems. OpenAI sends the merchant information and the merchant determines whether to accept or decline the order, charge the payment method, and confirm the order – all on their own systems.

Handling payments

The Delegated Payment Spec allows OpenAI to securely share payment details with the merchant or its designated payment service provider (PSP). The merchant and its PSP then handle the transaction and process the related payment in the same manner as any other order and payment they collect.

OpenAI prepares a one-time delegated payment request and sets a maximum chargeable amount and expiry based on what the user has selected to buy in ChatGPT’s UI.
This payload is passed to the merchant’s trusted PSP who will handle the transaction.
The PSP responds with a payment token that OpenAI passes on to the merchant to complete the payment.
Stripe’s Shared Payment Token is the first Delegated Payment Spec-compatible implementation, with more PSPs coming soon.
Eligible cards will be upgraded using network tokenization.
If you’re a PSP or a PCI DSS level 1 merchant with your own vault, learn how to build a direct integration with OpenAI.
OpenAI is not the merchant of record in the Agentic Commerce Protocol. Merchants are expected to bring their own PSP and handle payments just as they do for accepting any other digital payment. The OpenAI Delegated Payment Spec ensures that restrictions are placed on how these payment credentials are used to secure user transactions.

End-to-end flow diagram

This diagram illustrates the end-to-end data flow of the Agentic Commerce Protocol.

Agentic Commerce Protocol flow diagram

Agentic commerce in production
Checklist for launching in production and FAQs

Building with the Agentic Commerce Protocol is open to all. Instant Checkout in ChatGPT is currently available to approved partners. To apply to participate in Instant Checkout, fill out this form here.
Testing and launch certification

Before going live, complete and document the following tests in a sandbox environment.

Each item should be demonstrated end-to-end with request/response logs.

Session creation and address handling

Create a checkout session with and without a shipping address.
Verify that shipping options and tax totals are returned once a valid address is provided.
Confirm API-Version header is present and matches a supported version.
Shipping option updates

Update the selected shipping option.
Ensure order totals are recomputed correctly when the option changes.
Payment tokenization

Create a delegated payment token.
Send a POST /agentic_commerce/delegate_payment request with a valid payment_method object, allowance, billing_address, risk_signals, and metadata.
Include all required headers.
Verify canonical JSON serialization and correct detached signature generation.
Order completion

Complete the order with a tokenized payment.
Confirm the response contains the final order object in the completed state.
Validate returned fields and ensure HTTP 201 Created status.
Order updates

Emit order events.
Verify that both order_created and subsequent order_updated webhooks are sent with a valid HMAC signature.
Error scenarios

Demonstrate recoverable error handling.
Trigger and log each error condition with appropriate HTTP status:
missing (e.g., required field omitted → invalid_request / 400)
out_of_stock (simulate inventory failure)
payment_declined (simulate issuer decline)
Idempotency

Verify idempotency safety.
Repeat create and complete calls using the same Idempotency-Key to confirm:
Safe duplicate requests return the same result.
Parameter mismatches return idempotency_conflict with HTTP 409.
Documentation and links

Check legal and UX links.
Ensure Terms of Service and Privacy Policy links are present and functional.
IP egress ranges

Allowlist OpenAI’s IP addresses
OpenAI will call your action from an IP address from one of the CIDR blocks listed in chatgpt-connectors.json.
Security and compliance

Security is a top priority for the Agentic Commerce Protocol and Instant Checkout. Our security practices and trust and compliance portal provide our most comprehensive and up-to-date documentation. For reference, here is our Privacy Policy and Terms of Use.

TLS and HTTPS

All traffic to you must use TLS 1.2 or later on port 443 with a valid public certificate.

PCI Scope

The Product Feed Spec and Agentic Checkout Spec are deliberately kept out of PCI scope and do not transmit cardholder data. Using your PSP’s implementation of the Delegated Payment Spec may avoid any change in your PCI scope. However, using either your PSP’s forwarding APIs or integrating directly with OpenAI’s Delegated Payment endpoints involves handling cardholder data (CHD) and will likely be in PCI scope. We intend to migrate entirely to using network tokens as they become supported while ensuring backwards compatibility for ineligible cards.

Directly integrating with the Delegated Payment Spec involves directly handling cardholder data (CHD) and may affect your PCI scope. Check with your PSP and consult with your Qualified Security Assessor (QSA) or other PCI compliance advisor to determine the impact on your specific PCI DSS obligations. OpenAI may require your attestation of compliance (AOC) before enabling production access.

FAQs

Who is the merchant of record in an agentic checkout flow?

The merchant actually selling goods and taking payment directly from the customer is. OpenAI and other trusted payment service providers are not the merchant of record. Customers will see the Merchant’s name on their credit card statement, as if they bought directly from the merchant website.

Who manages chargebacks and refunds?

The merchant does. Your platform is responsible for handling refunds and chargebacks, as you accepted the payment directly from the customer as the merchant of record.

Use the ORDER_UPDATE webhook to notify ChatGPT (or any integrated partner) when a refund or chargeback status changes so order state stays synchronized.

Do we need to support multiple shipments?

Today, the protocol models a single shipping address and one selected shipping option per checkout session. In the future, the protocol may support multiple shipments.

If your system supports split shipments, consolidate them into a single buyer-visible selection and return aggregate totals for shipping and tax..