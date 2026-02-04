# Agentic Checkout Spec

## Overview

Enable merchants to run end-to-end checkout flows inside ChatGPT while keeping orders, payments, and compliance on their existing commerce stack.

**How it works**

1. Create session (REST). ChatGPT calls your `POST /checkout_sessions` to start a session with cart contents and buyer context; your response must include a rich, authoritative cart state.
2. Update session (REST). As the user changes items, shipping, or discounts, ChatGPT calls `POST /checkout_sessions/{checkout_session_id}`; each response returns the full cart state for display and validation.
3. Order events (webhooks). Your system publishes order lifecycle events (e.g., `order.created`, `order.updated`) to the provided webhook so ChatGPT stays in sync with fulfillment-grade truth.
4. Complete checkout (REST). ChatGPT finalizes via `POST /checkout_sessions/{checkout_session_id}/complete`; you confirm order creation and return the final cart and order identifiers.
5. Optionally, cancel checkouts using POST `/checkout_sessions/{checkout_session_id}/cancel` and get checkout information with `GET /checkout_sessions/{checkout_session_id}`.
6. Payments on your rails. You process payment with your existing PSP; if using Delegated Payments, accept the token and apply your normal authorization/capture flow.

**Key points**

- **Required endpoints.** Implement create, update, and complete checkout session REST endpoints; all responses must return a rich cart state (items, pricing, taxes/fees, shipping, discounts, totals, status).
- **Authoritative webhooks.** Emit order events to the provided webhook to keep state consistent across retries and edge cases.
- **Keep payments where they are.** Use your current PSP and settlement processes; integrate Delegated Payments only if applicable.
- **Security and robustness.** Authenticate every request, verify signatures, enforce idempotency, validate inputs, and support safe retries.
- **Certify integration.** Pass conformance checks (schema, error codes, rate limits, webhook delivery) to ensure reliable in-ChatGPT checkout.

## Checkout session

For users to place an order through ChatGPT, you must create, update and complete a Checkout session. This Checkout session holds information about items to be purchased, fulfillment information, and payment information.

As the user progresses through the checkout flow the Checkout session will be updated and move between various states.

The response to update calls, should return all checkout options, messages, and errors to be displayed to the user. Once the customer clicks “Buy”, the checkout session is completed with a selected payment method.

![State diagram showing order states](https://developers.openai.com/images/commerce/commerce-order-states.png)

## REST endpoints

Merchants must implement the following five endpoints to place orders on behalf of ChatGPT users.

In the future, the Agentic Checkout Spec will support MCP servers.

### Common features of all endpoints

All endpoints must use HTTPS and return JSON.

#### Request headers

All endpoints will be called with the following headers set:

| Field           | Description                                               | Example Value                                   |
| :-------------- | :-------------------------------------------------------- | :---------------------------------------------- |
| Authorization   | API Key used to make requests                             | `Bearer api_key_123`                            |
| Accept-Language | The preferred locale for content like messages and errors | `en-US`                                         |
| User-Agent      | Information about the client making this request          | `ChatGPT/2.0 (Mac OS X 15.0.1; arm64; build 0)` |
| Idempotency-Key | Key used to ensure requests are idempotent                | `idempotency_key_123`                           |
| Request-Id      | Unique key for each request for tracing purposes          | `request_id_123`                                |
| Content-Type    | Type of request content                                   | `application/json`                              |
| Signature       | Base64 encoded signature of the request body              | `eyJtZX...`                                     |
| Timestamp       | Formatted as an RFC 3339 string.                          | 2025-09-25T10:30:00Z                            |
| API-Version     | API version                                               | 2025-09-12                                      |

#### Response headers

| Field           | Description                           | Example Value         |
| :-------------- | :------------------------------------ | :-------------------- |
| Idempotency-Key | Idempotency key passed in the request | `idempotency_key_123` |
| Request-Id      | Request ID passed in the request      | `request_id_123`      |

### POST /checkout_sessions

Call direction: OpenAI -> Merchant

This is the initial call to create a checkout session. The call will contain information about the items the customer wishes to purchase and should return line item information, along with any messages or errors to be displayed to the customer. It should always return a checkout session id. All responses should be returned with a 201 status.

#### Request

| Field               | Type       | Required | Description                                                 | Validation                 |
| :------------------ | :--------- | :------- | :---------------------------------------------------------- | :------------------------- |
| buyer               | Buyer      | No       | Optional information about the buyer.                       | None                       |
| items               | List[Item] | Yes      | The initial list of items to initiate the checkout session. | Should be a non empty list |
| fulfillment_address | Address    | No       | Optional fulfillment address if present.                    | None                       |

#### Response

| Field                 | Type                    | Required | Description                                                                                                                     | Validation                                        |
| :-------------------- | :---------------------- | :------- | :------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------ |
| id                    | String                  | Yes      | Unique id that identifies the checkout session. This id will be used to update the checkout session in subsequent calls.        | None                                              |
| buyer                 | Buyer                   | No       | Buyer information, if provided                                                                                                  | None                                              |
| payment_provider      | PaymentProvider         | Yes      | Payment provider that will be used to complete this transaction.                                                                | None                                              |
| status                | String enum             | Yes      | Current status of the checkout session. Possible values are: `not_ready_for_payment` `ready_for_payment` `completed` `canceled` | None                                              |
| currency              | String                  | Yes      | Currency code as per the ISO 4217 standard                                                                                      | Should follow the ISO 4217 standard in lower case |
| line_items            | List[LineItem]          | Yes      | List of items and computed costs.                                                                                               | None                                              |
| fulfillment_address   | Address                 | No       | Address to ship items to.                                                                                                       | None                                              |
| fulfillment_options   | List[FulfillmentOption] | Yes      | All available fulfillment options and associated costs.                                                                         | None                                              |
| fulfillment_option_id | String                  | No       | Id of the selected fulfillment option.                                                                                          | None                                              |
| totals                | List[Total]             | Yes      | List of totals.                                                                                                                 | None                                              |
| messages              | List[Message]           | Yes      | List of informational and error messages to be displayed to the customer.                                                       | None                                              |
| links                 | List[Link]              | Yes      | List of links (e.g. ToS/privacy policy/etc.) to be displayed to the customer.                                                   | None                                              |

#### Examples

1. Creating a checkout session with a single item and quantity. No fulfillment address is provided, so the checkout cannot be completed.

```json
POST Request to /checkout_sessions

{
   "items": [
       {
           "id": "item_123",
           "quantity": 1
       }
   ]
}
```

```json
Response

{
   "id": "checkout_session_123",
   "payment_provider": {
       "provider": "stripe",
       "supported_payment_methods": ["card"]
   },
   "status": "in_progress",
   "currency": "usd",
   "line_items": [
       {
           "id": "line_item_123",
           "item": {
               "id": "item_123",
               "quantity": 1
           },
           "base_amount": 300,
           "discount": 0,
           "subtotal": 300,
           "tax": 30,
           "total": 330
       }
   ],
   "totals": [
       {
           "type": "items_base_amount",
           "display_text": "Item(s) total",
           "amount": 300
       },
       {
           "type": "subtotal",
           "display_text": "Subtotal",
           "amount": 300
       },
       {
           "type": "tax",
           "display_text": "Tax",
           "amount": "0.30"
       },
       {
           "type": "total",
           "display_text": "Total",
           "amount": 330
       }
   ],
   "fulfillment_options": [],
   "messages": [
       {
           "type": "error",
           "code": "out_of_stock",
           "path": "$.line_items[0]",
           "content_type": "plain",
           "content": "This item is not available for sale.",
       }
   ],
   "links": [
       {
           "type": "terms_of_use",
           "url": "https://www.testshop.com/legal/terms-of-use"
       }
   ]
}
```

2. Creating a checkout session with a single item and quantity, and a provided fulfillment address. Since a fulfillment address is provided, taxes are returned as well. Fulfillment options are also available, and the cheapest one is selected by default. Any messages to show to the customer based on their fulfillment address (e.g. CA 65 warning) are also returned.

```json
POST Request to /checkout_sessions

{
   "items": [
       {
           "id": "item_456",
           "quantity": 1
       }
   ],
   "fulfillment_address": {
       "name": "test",
       "line_one": "1234 Chat Road",
       "line_two": "Apt 101",
       "city": "San Francisco",
       "state": "CA",
       "country": "US",
       "postal_code": "94131"
   }
}

```

```json
Response

{
   "id": "checkout_session_123",
   "payment_provider": {
       "provider": "stripe",
       "supported_payment_methods": ["card"]
   },
   "status": "ready_for_payment",
   "currency": "usd",
   "line_items": [
       {
           "id": "line_item_456",
           "item": {
               "id": "item_456",
               "quantity": 1
           },
           "base_amount": 300,
           "discount": 0,
           "subtotal": 0,
           "tax": 30,
           "total": 330
       }
   ],
   "fulfillment_address": {
       "name": "test",
       "line_one": "1234 Chat Road",
       "line_two": "Apt 101",
       "city": "San Francisco",
       "state": "CA",
       "country": "US",
       "postal_code": "94131"
   },
   "fulfillment_option_id": "fulfillment_option_123",
   "totals": [
       {
           "type": "items_base_amount",
           "display_text": "Item(s) total",
           "amount": 300
       },
       {
           "type": "subtotal",
           "display_text": "Subtotal",
           "amount": 300
       },
       {
           "type": "tax",
           "display_text": "Tax",
           "amount": 30
       },
       {
           "type": "fulfillment",
           "display_text": "Fulfillment",
           "amount": 100
       },
       {
           "type": "total",
           "display_text": "Total",
           "amount": 430
       }
   ],
   "fulfillment_options": [
       {
           "type": "shipping",
           "id": "fulfillment_option_123",
           "title": "Standard",
           "subtitle": "Arrives in 4-5 days",
           "carrier": "USPS",
           "earliest_delivery_time": "2025-10-12T07:20:50.52Z",
           "latest_delivery_time": "2025-10-13T07:20:50.52Z",
           "subtotal": 100,
           "tax": 0,
           "total": 100
       },
       {
           "type": "shipping",
           "id": "fulfillment_option_456",
           "title": "Express",
           "subtitle": "Arrives in 1-2 days",
           "carrier": "USPS",
           "earliest_delivery_time": "2025-10-09T07:20:50.52Z",
           "latest_delivery_time": "2025-10-10T07:20:50.52Z",
           "subtotal": 500,
           "tax": 0,
           "total": 500
       }
   ],
   "messages": [],
   "links": [
       {
           "type": "terms_of_use",
           "url": "https://www.testshop.com/legal/terms-of-use"
       }
   ]
}
```

### POST `/checkout_sessions/{checkout_session_id}`

Call direction: OpenAI -> Merchant

This endpoint will be called on checkout session updates, such as a change in fulfillment address or fulfillment option. The endpoint should return updated costs, new options (e.g. new fulfillment options based on update in fulfillment address), and any new errors.

#### Request

| Field                 | Type       | Required | Description                                                           | Validation |
| :-------------------- | :--------- | :------- | :-------------------------------------------------------------------- | :--------- |
| buyer                 | Buyer      | No       | Optional information about the buyer.                                 | None       |
| items                 | List[Item] | No       | Optional list of updated items to be purchased.                       | None       |
| fulfillment_address   | Address    | No       | Newly added or updated fulfillment address specified by the customer. | None       |
| fulfillment_option_id | String     | No       | Id of the fulfillment option specified by the customer.               | None       |

#### Response

| Field                 | Type                    | Required | Description                                                                                                                     | Validation                                        |
| :-------------------- | :---------------------- | :------- | :------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------ |
| id                    | String                  | Yes      | Unique id that identifies the checkout session. This id will be used to update the checkout session in subsequent calls.        | None                                              |
| buyer                 | Buyer                   | No       | Buyer information, if provided                                                                                                  | None                                              |
| status                | String enum             | Yes      | Current status of the checkout session. Possible values are: `not_ready_for_payment` `ready_for_payment` `completed` `canceled` | None                                              |
| currency              | String                  | Yes      | Currency code as per the ISO 4217 standard                                                                                      | Should follow the ISO 4217 standard in lower case |
| line_items            | List[LineItem]          | Yes      | List of items and computed costs.                                                                                               | None                                              |
| fulfillment_address   | Address                 | No       | Address to ship items to.                                                                                                       | None                                              |
| fulfillment_options   | List[FulfillmentOption] | Yes      | All available fulfillment options and associated costs.                                                                         | None                                              |
| fulfillment_option_id | String                  | No       | Id of the selected fulfillment option.                                                                                          | None                                              |
| totals                | List[Total]             | Yes      | List of totals.                                                                                                                 | None                                              |
| messages              | List[Message]           | Yes      | List of informational and error messages to be displayed to the customer.                                                       | None                                              |
| links                 | List[Link]              | Yes      | List of links (e.g. ToS/privacy policy/etc.) to be displayed to the customer.                                                   | None                                              |

#### Example

Updating the fulfillment option updates the checkout session totals.

```json
POST Request to /checkout_sessions/checkout_session_123

{
   "fulfillment_option_id": "fulfillment_option_456"
}
```

```json
Response

{
   "id": "checkout_session_123",
   "status": "ready_for_payment",
   "currency": "usd",
   "line_items": [
       {
           "id": "line_item_456",
           "item": {
               "id": "item_456",
               "quantity": 1
           },
           "base_amount": 300,
           "discount": 0,
           "subtotal": 0,
           "tax": 30,
           "total": 330
       }
   ],
   "fulfillment_address": {
       "name": "test",
       "line_one": "1234 Chat Road",
       "line_two": "Apt 101",
       "city": "San Francisco",
       "state": "CA",
       "country": "US",
       "postal_code": "94131"
   },
   "fulfillment_option_id": "fulfillment_option_456",
   "totals": [
       {
           "type": "items_base_amount",
           "display_text": "Item(s) total",
           "amount": 300
       },
       {
           "type": "subtotal",
           "display_text": "Subtotal",
           "amount": 300
       },
       {
           "type": "tax",
           "display_text": "Tax",
           "amount": 30
       },
       {
           "type": "fulfillment",
           "display_text": "Fulfillment",
           "amount": 500
       },
       {
           "type": "total",
           "display_text": "Total",
           "amount": 830
       }
   ],
   "fulfillment_options": [
       {
           "type": "shipping",
           "id": "fulfillment_option_123",
           "title": "Standard",
           "subtitle": "Arrives in 4-5 days",
           "carrier": "USPS",
           "earliest_delivery_time": "2025-10-12T07:20:50.52Z",
           "latest_delivery_time": "2025-10-13T07:20:50.52Z",
           "subtotal": 100,
           "tax": 0,
           "total": 100
       },
       {
           "type": "shipping",
           "id": "fulfillment_option_456",
           "title": "Express",
           "subtitle": "Arrives in 1-2 days",
           "carrier": "USPS",
           "earliest_delivery_time": "2025-10-09T07:20:50.52Z",
           "latest_delivery_time": "2025-10-10T07:20:50.52Z",
           "subtotal": 500,
           "tax": 0,
           "total": 500
       }
   ],
   "messages": [],
   "links": [
       {
           "type": "terms_of_use",
           "url": "https://www.testshop.com/legal/terms-of-use"
       }
   ]
}
```

### POST `/checkout_sessions/{checkout_session_id}/complete`

Call direction: OpenAI -> Merchant

The endpoint will be called with the payment method to complete the purchase. It is expected that the checkout session will be completed and an order will be created after this call. Any errors that prevent this from happening should be returned in the response.

#### Request

| Field        | Type        | Required | Description                                         | Validation |
| :----------- | :---------- | :------- | :-------------------------------------------------- | :--------- |
| buyer        | Buyer       | No       | Optional information about the buyer.               | None       |
| payment_data | PaymentData | Yes      | Payment data used to complete the checkout session. | None       |

#### Response

| Field                 | Type                    | Required | Description                                                                                                                     | Validation                                        |
| :-------------------- | :---------------------- | :------- | :------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------ |
| id                    | String                  | Yes      | Unique id that identifies the checkout session. This id will be used to update the checkout session in subsequent calls.        | None                                              |
| buyer                 | Buyer                   | Yes      | Buyer information                                                                                                               | None                                              |
| status                | String enum             | Yes      | Current status of the checkout session. Possible values are: `not_ready_for_payment` `ready_for_payment` `completed` `canceled` | None                                              |
| currency              | String                  | Yes      | Currency code as per the ISO 4217 standard                                                                                      | Should follow the ISO 4217 standard in lower case |
| line_items            | List[LineItem]          | Yes      | List of items and computed costs.                                                                                               | None                                              |
| fulfillment_address   | Address                 | No       | Address to ship items to.                                                                                                       | None                                              |
| fulfillment_options   | List[FulfillmentOption] | Yes      | All available fulfillment options and associated costs.                                                                         | None                                              |
| fulfillment_option_id | String                  | No       | Id of the selected fulfillment option.                                                                                          | None                                              |
| totals                | List[Total]             | Yes      | List of totals.                                                                                                                 | None                                              |
| order                 | Order                   | No       | Order that is created after the checkout session completes.                                                                     | None                                              |
| messages              | List[Message]           | Yes      | List of informational and error messages to be displayed to the customer.                                                       | None                                              |
| links                 | List[Link]              | Yes      | List of links (e.g. ToS/privacy policy/etc.) to be displayed to the customer.                                                   | None                                              |

#### Example

Completing the checkout session with an encrypted payload representing the payment method.

```json
POST Request to /checkout_sessions/checkout_session_123/complete

{
   "buyer": {
       "name": "John Smith",
       "email": "johnsmith@mail.com",
       "phone_number": "+15552003434"
   },
   "payment_data": {
       "token": "spt_123",
       "provider": "stripe",
       "billing_address": {
           "name": "test",
           "line_one": "1234 Chat Road",
           "line_two": "Apt 101",
           "city": "San Francisco",
           "state": "CA",
           "country": "US",
           "postal_code": "94131",
           "phone_number": "+15552428478"
       }
   }
}

```

```json
Response

{
   "id": "checkout_session_123",
   "buyer": {
       "name": "John Smith",
       "email": "johnsmith@mail.com",
       "phone_number": "+15552003434"
   },
   "status": "completed",
   "currency": "usd",
   "line_items": [
       {
           "id": "line_item_456",
           "item": {
               "id": "item_456",
               "quantity": 1
           },
           "base_amount": 300,
           "discount": 0,
           "subtotal": 300,
           "tax": 30,
           "total": 330
       }
   ],
   "fulfillment_address": {
       "name": "test",
       "line_one": "1234 Chat Road",
       "line_two": "Apt 101",
       "city": "San Francisco",
       "state": "CA",
       "country": "US",
       "postal_code": "94131"
   },
   "fulfillment_option_id": "fulfillment_option_123",
   "totals": [
       {
           "type": "items_base_amount",
           "display_text": "Item(s) total",
           "amount": 300
       },
       {
           "type": "subtotal",
           "display_text": "Subtotal",
           "amount": 300
       },
       {
           "type": "tax",
           "display_text": "Tax",
           "amount": 30
       },
       {
           "type": "fulfillment",
           "display_text": "Fulfillment",
           "Amount": 100
       },
       {
           "type": "total",
           "display_text": "Total",
           "amount": 430
       }
   ],
   "fulfillment_options": [
       {
           "type": "shipping",
           "id": "fulfillment_option_123",
           "title": "Standard",
           "subtitle": "Arrives in 4-5 days",
           "carrier": "USPS",
           "earliest_delivery_time": "2025-10-12T07:20:50.52Z",
           "latest_delivery_time": "2025-10-13T07:20:50.52Z",
           "subtotal": 100,
           "tax": 0,
           "total": 100
       },
       {
           "type": "shipping",
           "id": "fulfillment_option_456",
           "title": "Express",
           "subtitle": "Arrives in 1-2 days",
           "carrier": "USPS",
           "earliest_delivery_time": "2025-10-09T07:20:50.52Z",
           "latest_delivery_time": "2025-10-10T07:20:50.52Z",
           "subtotal": 500,
           "tax": 0,
           "total": 500
       }
   ],
   "messages": [],
   "links": [
       {
           "type": "terms_of_use",
           "url": "https://www.testshop.com/legal/terms-of-use"
       }
   ]
}
```

### POST `/checkout_sessions/{checkout_session_id}/cancel`

This endpoint will be used to cancel a checkout session, if it can be canceled. If the checkout session cannot be canceled (e.g. if the checkout session is already canceled or completed), then the server should send back a response with status 405. Any checkout session with a status that is not equal to completed or canceled should be cancelable.

#### Request

None

#### Response

| Field                 | Type                    | Required | Description                                                                                                                     | Validation                                        |
| :-------------------- | :---------------------- | :------- | :------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------ |
| id                    | String                  | Yes      | Unique id that identifies the checkout session. This id will be used to update the checkout session in subsequent calls.        | None                                              |
| buyer                 | Buyer                   | No       | Buyer information, if provided                                                                                                  | None                                              |
| status                | String enum             | Yes      | Current status of the checkout session. Possible values are: `not_ready_for_payment` `ready_for_payment` `completed` `canceled` | None                                              |
| currency              | String                  | Yes      | Currency code as per the ISO 4217 standard                                                                                      | Should follow the ISO 4217 standard in lower case |
| line_items            | List[LineItem]          | Yes      | List of items and computed costs.                                                                                               | None                                              |
| fulfillment_address   | Address                 | No       | Address to ship items to.                                                                                                       | None                                              |
| fulfillment_options   | List[FulfillmentOption] | Yes      | All available fulfillment options and associated costs.                                                                         | None                                              |
| fulfillment_option_id | String                  | No       | Id of the selected fulfillment option.                                                                                          | None                                              |
| totals                | List[Total]             | Yes      | List of totals.                                                                                                                 | None                                              |
| messages              | List[Message]           | Yes      | List of informational and error messages to be displayed to the customer.                                                       | None                                              |
| links                 | List[Link]              | Yes      | List of links (e.g. ToS/privacy policy/etc.) to be displayed to the customer.                                                   | None                                              |

### GET `/checkout_sessions/{checkout_session_id}`

This endpoint is used to return update to date information about the checkout session. If the checkout session is not found, then the server should return a response with status 404.

#### Request

None

#### Response

| Field                 | Type                    | Required | Description                                                                                                                     | Validation                                        |
| :-------------------- | :---------------------- | :------- | :------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------ |
| id                    | String                  | Yes      | Unique id that identifies the checkout session. This id will be used to update the checkout session in subsequent calls.        | None                                              |
| buyer                 | Buyer                   | No       | Buyer information, if provided                                                                                                  | None                                              |
| status                | String enum             | Yes      | Current status of the checkout session. Possible values are: `not_ready_for_payment` `ready_for_payment` `completed` `canceled` | None                                              |
| currency              | String                  | Yes      | Currency code as per the ISO 4217 standard                                                                                      | Should follow the ISO 4217 standard in lower case |
| line_items            | List[LineItem]          | Yes      | List of items and computed costs.                                                                                               | None                                              |
| fulfillment_address   | Address                 | No       | Address to ship items to.                                                                                                       | None                                              |
| fulfillment_options   | List[FulfillmentOption] | Yes      | All available fulfillment options and associated costs.                                                                         | None                                              |
| fulfillment_option_id | String                  | No       | Id of the selected fulfillment option.                                                                                          | None                                              |
| totals                | List[Total]             | Yes      | List of totals.                                                                                                                 | None                                              |
| messages              | List[Message]           | Yes      | List of informational and error messages to be displayed to the customer.                                                       | None                                              |
| links                 | List[Link]              | Yes      | List of links (e.g. ToS/privacy policy/etc.) to be displayed to the customer.                                                   | None                                              |

### Response Errors

If the server is unable to return a 201 response, then it should return an error of the following shape with a 4xx/5xx status.

#### Error

| Field   | Type        | Required | Description                                                            |
| :------ | :---------- | :------- | :--------------------------------------------------------------------- |
| type    | String enum | Yes      | Error type. Possible values are: `invalid_request`                     |
| code    | String enum | Yes      | Error code. Possible values are: `request_not_idempotent`              |
| message | String      | Yes      | Human‑readable description of the error.                               |
| param   | String      | No       | JSONPath referring to the offending request body field, if applicable. |

## Object definitions

### Item

| Field    | Type   | Required | Description                                        | Example Value | Validation                                   |
| :------- | :----- | :------- | :------------------------------------------------- | :------------ | :------------------------------------------- |
| id       | string | Yes      | Id of a piece of merchandise that can be purchased | `“itm_123”`   | `None`                                       |
| quantity | int    | Yes      | Quantity of the item for fulfillment               | `1`           | Should be a positive integer greater than 0. |

### Address

| Field        | Type   | Required | Description                                      | Validation                            |
| :----------- | :----- | :------- | :----------------------------------------------- | :------------------------------------ |
| name         | String | Yes      | Name of the person to whom the items are shipped | Max. length is 256                    |
| line_one     | String | Yes      | First line of address                            | Max. length is 60                     |
| line_two     | String | No       | Optional second line of address                  | Max. length is 60                     |
| city         | String | Yes      | Address city/district/suburb/town/village.       | Max. length is 60                     |
| state        | String | Yes      | Address state/county/province/region.            | Should follow the ISO 3166-1 standard |
| country      | String | Yes      | Address country                                  | Should follow the ISO 3166-1 standard |
| postal_code  | String | Yes      | Address postal code or zip code                  | Max. length is 20                     |
| phone_number | String | No       | Optional phone number                            | Follows the E.164 standard            |

### PaymentProvider

| Field                     | Type              | Required | Description                                                                                    | Validation |
| :------------------------ | :---------------- | :------- | :--------------------------------------------------------------------------------------------- | :--------- |
| provider                  | String enum       | Yes      | String value representing payment processor. Possible values are: `stripe` `adyen` `braintree` | None       |
| supported_payment_methods | List[String enum] | Yes      | List of payment methods that the merchant is willing to accept. Possible values are: `card`    | None       |

### Message (type = info)

| Field        | Type        | Required | Description                                                                                                                                                                                          | Validation |
| :----------- | :---------- | :------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- |
| type         | String      | Yes      | String value representing the type of message. For an informational message, the type should be `info.`                                                                                              | None       |
| param        | String      | Yes      | RFC 9535 JSONPath to the component of the checkout session that the message is referring to. For instance, if the message is referring to the second line item, the path would be `$.line_items[1]`. | None       |
| content_type | String enum | Yes      | Type of the message content for rendering purposes. Possible values are: `plain` `markdown`                                                                                                          | None       |
| content      | String      | Yes      | Raw message content.                                                                                                                                                                                 | None       |

### Message (type = error)

| Field        | Type        | Required | Description                                                                                                                                                                                          | Validation |
| :----------- | :---------- | :------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- |
| type         | String      | Yes      | String value representing the type of message. For an error message, the type should be `error.`                                                                                                     | None       |
| code         | String enum | Yes      | Error code. Possible values are: `missing` `invalid` `out_of_stock` `payment_declined` `requires_sign_in` `requires_3ds`                                                                             | None       |
| param        | String      | No       | RFC 9535 JSONPath to the component of the checkout session that the message is referring to. For instance, if the message is referring to the second line item, the path would be `$.line_items[1]`. | None       |
| content_type | String enum | Yes      | Type of the message content for rendering purposes. Possible values are: `plain` `markdown`                                                                                                          | None       |
| content      | String      | Yes      | Raw message content.                                                                                                                                                                                 | None       |

### Link

| Field | Type         | Required | Description                                                                                   | Validation |
| :---- | :----------- | :------- | :-------------------------------------------------------------------------------------------- | :--------- |
| type  | Enum(String) | Yes      | Type of the link. Possible values are: `terms_of_use` `privacy_policy` `seller_shop_policies` | None       |
| url   | String       | Yes      | Link content specified as a URL.                                                              | None       |

### Buyer

| Field        | Type   | Required | Description                                              | Validation                 |
| :----------- | :----- | :------- | :------------------------------------------------------- | :------------------------- |
| name         | String | Yes      | Name of the buyer.                                       | Max. length is 256         |
| email        | String | Yes      | Email address of the buyer to be used for communication. | Max. length is 256         |
| phone_number | String | No       | Optional phone number of the buyer.                      | Follows the E.164 standard |

### Line Item

| Field       | Type   | Required | Description                                                                                                                                   | Validation                                                     |
| :---------- | :----- | :------- | :-------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------- |
| id          | String | Yes      | Id of the line item. This is different from the id of the item - two line items representing the same item will have different line item ids. | None                                                           |
| item        | Item   | Yes      | Item that is represented by the line item.                                                                                                    | None                                                           |
| base_amount | int    | Yes      | Integer representing item base amount before adjustments.                                                                                     | Should be >= 0                                                 |
| discount    | int    | Yes      | Integer representing any discount applied to the item.                                                                                        | Should be >= 0                                                 |
| subtotal    | int    | Yes      | Integer representing amount after all adjustments.                                                                                            | Should sum up to `base_amount - discount` Should be >= 0       |
| tax         | int    | Yes      | Integer representing tax amount.                                                                                                              | Should be >= 0                                                 |
| total       | int    | Yes      | Integer representing total amount.                                                                                                            | Should sum up to `base_amount - discount + tax` Should be >= 0 |

### Total

| Field        | Type        | Required | Description                                                                                                                                                    | Validation                                                                                                                                                                                           |
| :----------- | :---------- | :------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| type         | String enum | Yes      | String value representing the type of total. Possible values are: `items_base_amount` `items_discount` `subtotal` `discount` `fulfillment` `tax` `fee` `total` | None                                                                                                                                                                                                 |
| display_text | String      | Yes      | The text displayed to the customer for this total.                                                                                                             | None                                                                                                                                                                                                 |
| amount       | int         | Yes      | Integer representing total amount in minor units.                                                                                                              | If type == `subtotal`, should sum to `items_base_amount - items_discount` If type == `total`, should sum to `items_base_amount - items_discount - discount + fulfillment + tax + fee` Should be >= 0 |

### FulfillmentOption (type = shipping)

| Field                  | Type   | Required | Description                                                                                                      | Validation                             |
| :--------------------- | :----- | :------- | :--------------------------------------------------------------------------------------------------------------- | :------------------------------------- |
| type                   | String | Yes      | String value representing the type of fulfillment option. For a shipping option, the value should be `shipping.` | None                                   |
| id                     | String | Yes      | Unique ID that represents the shipping option. Unique across all fulfillment options.                            | Unique across all fulfillment options. |
| title                  | String | Yes      | Title of the shipping option to display to the customer.                                                         | None                                   |
| subtitle               | String | Yes      | Text content describing the estimated timeline for shipping to display to the customer.                          | None                                   |
| carrier                | String | Yes      | Name of the shipping carrier.                                                                                    | None                                   |
| earliest_delivery_time | String | Yes      | Estimated earliest delivery time, formatted as an RFC 3339 string.                                               | Formatted as an RFC 3339 string.       |
| latest_delivery_time   | String | Yes      | Estimated latest delivery time, formatted as an RFC 3339 string.                                                 | Formatted as an RFC 3339 string.       |
| subtotal               | int    | Yes      | Integer subtotal cost of the shipping option, formatted as a string.                                             | Should be >= 0                         |
| tax                    | int    | Yes      | Integer representing tax amount.                                                                                 | Should be >= 0                         |
| total                  | int    | Yes      | Integer total cost of the shipping option, formatted as a string.                                                | Should sum to `subtotal + tax`         |

### FulfillmentOption (type = digital)

| Field    | Type   | Required | Description                                                                                                    | Validation                             |
| :------- | :----- | :------- | :------------------------------------------------------------------------------------------------------------- | :------------------------------------- |
| type     | String | Yes      | String value representing the type of fulfillment option. For a digital option, the value should be `digital.` | None                                   |
| id       | String | Yes      | Unique ID that represents the digital option. Unique across all fulfillment options.                           | Unique across all fulfillment options. |
| title    | String | Yes      | Title of the digital option to display to the customer.                                                        | None                                   |
| subtitle | String | No       | Text content describing how the item will be digitally delivered to the customer.                              | None                                   |
| subtotal | int    | Yes      | Integer subtotal cost of the digital option, formatted as a string.                                            | Should be >= 0                         |
| tax      | int    | Yes      | Integer representing tax amount.                                                                               | Should be >= 0                         |
| total    | int    | Yes      | Integer total cost of the digital option, formatted as a string.                                               | Should sum to `subtotal + tax`         |

### PaymentData

| Field           | Type        | Required | Description                                                                                        | Validation |
| :-------------- | :---------- | :------- | :------------------------------------------------------------------------------------------------- | :--------- |
| token           | String      | Yes      | Token that represents the payment method.                                                          | None       |
| provider        | String enum | Yes      | String value representing the payment processor. Possible values are: `stripe` `adyen` `braintree` | None       |
| billing_address | Address     | No       | Optional billing address associated with the payment method                                        | None       |

### Order

| Field               | Type   | Required | Description                                                                                                                             | Validation |
| :------------------ | :----- | :------- | :-------------------------------------------------------------------------------------------------------------------------------------- | :--------- |
| id                  | String | Yes      | Unique id that identifies the order that is created after completing the checkout session.                                              | None       |
| checkout_session_id | String | Yes      | Id that identifies the checkout session that created this order                                                                         | None       |
| permalink_url       | String | Yes      | URL that points to the order. Customers should be able to visit this URL and provide at most their email address to view order details. | None       |

## Webhooks

The merchant sends OpenAI webhook events on order creation and update events. These events ensure that the buyer’s view stays in sync. The webhook events will be sent with a HMAC signature sent as a request header (i.e. `Merchant_Name-Signature`) that is created using the webhook payload and signed using a key provided by OpenAI.

### Webhook Event

| Field | Type        | Required | Description                                                                                 | Validation |
| :---- | :---------- | :------- | :------------------------------------------------------------------------------------------ | :--------- |
| type  | String enum | Yes      | String representing the type of event. Possible values are: `order_created` `order_updated` | None       |
| data  | EventData   | Yes      | Webhook event data. See EventData for more information.                                     | None       |

### EventData (type = order)

| Field               | Type         | Required | Description                                                                                                                                     | Validation |
| :------------------ | :----------- | :------- | :---------------------------------------------------------------------------------------------------------------------------------------------- | :--------- |
| type                | String       | Yes      | String value representing the type of event data. For order data, the value should be `order`                                                   | None       |
| checkout_session_id | String       | Yes      | ID that identifies the checkout session that created this order.                                                                                | None       |
| permalink_url       | String       | Yes      | URL that points to the order. Customers should be able to visit this URL and provide at most their email address to view order details.         | None       |
| status              | String enum  | Yes      | String representing the latest status of the order. Possible values are: `created` `manual_review` `confirmed` `canceled` `shipped` `fulfilled` | None       |
| refunds             | List[Refund] | Yes      | List of refunds that have been issued for the order.                                                                                            | None       |

### Refund

| Field  | Type        | Required | Description                                                                                    | Validation     |
| :----- | :---------- | :------- | :--------------------------------------------------------------------------------------------- | :------------- |
| type   | String enum | Yes      | String representing the type of refund. Possible values are: `store_credit` `original_payment` | None           |
| amount | integer     | Yes      | Integer representing total amount of money refunded.                                           | Should be >= 0 # Delegated Payment Spec

## Overview

The delegated payment spec allows OpenAI to securely share payment details with the merchant or its designated payment service provider (PSP). The merchant and its PSP then handle the transaction and process the related payment in the same manner as any other order and payment they collect.

### Who is this spec for?

Directly integrating with OpenAI via the Delegated Payment Spec is only for PSPs or PCI DSS level 1 merchants using their own vaults. For others, [Stripe’s Shared Payment Token](https://docs.stripe.com/agentic-commerce) is the first Delegated Payment Spec-compatible implementation, with more PSPs coming soon.

### How it works

1. Buyers check out using their preferred payment method and save it in ChatGPT.
2. The delegated payment payload is sent to the merchant’s PSP or vault directly. The delegated payment is single-use and set with allowances.
3. The PSP or vault returns a payment token scoped to the delegated payment outside of PCI scope.
4. OpenAI forwards the token during the complete-checkout call to enable the merchant to complete the transaction.

### Key points

- **OpenAI is not the merchant of record**. Under the Agentic Commerce Protocol, merchants bring their own PSP and process payments as they would for any other digital transaction.
- **Single-use and constrained**. The payment token is restricted by the delegated payment’s max amount and expiry, helping protect users and prevent misuse.
- **Merchant-owned payments**. Settlement, refunds, chargebacks, and compliance remain with the merchant and their PSP.
- **Security by design**. The Delegated Payment Spec ensures PSP-returned credentials are narrowly scoped and cannot be used outside the defined limits of the user-approved purchase.
- **PCI Scope**. Directly integrating with the Delegated Payment Spec involves directly handling cardholder data (CHD) and may affect your PCI scope.

## REST endpoints

### POST /agentic_commerce/delegate_payment

Call direction: OpenAI -> PSP

#### Headers

| Field           | Description                                               | Example Value                                   |
| :-------------- | :-------------------------------------------------------- | :---------------------------------------------- |
| Authorization   | API Key used to make requests                             | `Bearer api_key_123`                            |
| Accept-Language | The preferred locale for content like messages and errors | `en-US`                                         |
| User-Agent      | Information about the client making this request          | `ChatGPT/2.0 (Mac OS X 15.0.1; arm64; build 0)` |
| Idempotency-Key | Key used to ensure requests are idempotent                | `idempotency_key_123`                           |
| Request-Id      | Unique key for each request for tracing purposes          | `request_id_123`                                |
| Content-Type    | Type of request content                                   | `application/json`                              |
| Signature       | Base64 encoded signature of the request body              | `eyJtZX...`                                     |
| Timestamp       | Formatted as an RFC 3339 string.                          | 2025-09-25T10:30:00Z                            |
| API-Version     | API version                                               | 2025-09-12                                      |

Exactly one of the following inputs must be present in the request body: card.

#### Request

| Field           | Type                     | Required | Description                                             | Example                         | Validation |
| :-------------- | :----------------------- | :------- | :------------------------------------------------------ | :------------------------------ | :--------- |
| payment_method  | Object                   | Yes      | Type of credential. The only accepted value is “CARD”.  | See Payment Method              | None       |
| allowance       | Allowance object         | Yes      | Use cases that the stored credential can be applied to. | See Allowance object definition | None       |
| billing_address | Address object           | No       | Address associated with the payment method.             | See Address object definition   | None       |
| risk_signals    | list[Risk Signal object] | Yes      | List of risk signals                                    | See Risk Signal definition      | None       |
| metadata        | Object (map)             | Yes      | Arbitrary key/value pairs.                              | `{ "campaign": "q4"}`           | None       |

#### Response

##### Success

Response code: HTTP 201

**Response Body**

| Field    | Type   | Required | Description                                                                                   | Validation |
| :------- | :----- | :------- | :-------------------------------------------------------------------------------------------- | :--------- |
| id       | String | Yes      | Unique vault token identifier vt\_….                                                          | None       |
| created  | String | Yes      | Time formatted as an RFC 3339 string                                                          | None       |
| metadata | Object | Yes      | Arbitrary key/value pairs for correlation (e.g., `source`, `merchant_id`, `idempotency_key`). | None       |

##### Error

Response code: HTTP 4xx/5xx

**Response Body**

| Field   | Type        | Required | Description                                                                 | Example                                                               | Validation |
| :------ | :---------- | :------- | :-------------------------------------------------------------------------- | :-------------------------------------------------------------------- | :--------- |
| type    | String enum | Yes      | Error type                                                                  | invalid_requestrate_limit_exceededprocessing_errorservice_unavailable | None       |
| code    | String      | Yes      | Error code                                                                  | invalid_card                                                          | None       |
| message | String      | Yes      | Human‑readable description suitable for logs/support (often end‑user safe). | Missing/malformed field                                               | None       |
| param   | JSONPath    | No       | Name of the offending request field, when applicable.                       | payment_method.number                                                 | None       |

## Code values and meanings

- **invalid_request** — Missing or malformed field; typically returns **400**.

  _Example message:_ `”card field is required when payment_method_type=card”`.
  - **invalid_card** — Credential failed basic validation (such as length or expiry); returns **400** or **422**.

  - **idempotency_conflict** — Same idempotency key but different parameters; returns **409**.

- **rate_limit_exceeded** — Too many requests; returns **429**.

- **processing_error** — Downstream gateway or network failure; returns **500**.

- **service_unavailable** — Temporary outage or maintenance; returns **503** with an optional retry_after header.

## Object definitions

#### Payment method

| Field                     | Type           | Required | Description                                                                                                                                                         | Example                               | Validation                               |
| ------------------------- | :------------- | :------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- | ---------------------------------------- |
| type                      | String enum    | Yes      | The type of payment method used. Currently only `card`.                                                                                                             | card                                  | Must be card                             |
| card_number_type          | String enum    | Yes      | The type of card number. Network tokens are preferred with fallback to FPAN. See [PCI Scope](https://developers.openai.com/commerce/guides/production#security-and-compliance) for more details. | “fpan” or “network_token”             | Must be “fpan” or “network_token”        |
| number                    | String         | Yes      | Card number.                                                                                                                                                        | "4242424242424242"                    |                                          |
| exp_month                 | String         | No       | Expiry month.                                                                                                                                                       | "11"                                  | Max. length 2                            |
| exp_year                  | String         | No       | 4 digit expiry year.                                                                                                                                                | "2026"                                | Max. length 4                            |
| name                      | String         | No       | Cardholder name.                                                                                                                                                    | "Jane Doe"                            |                                          |
| cvc                       | String         | No       | Card CVC number.                                                                                                                                                    | "223"                                 | Max. length 4                            |
| cryptogram                | String         | No       | Cryptogram provided with network tokens.                                                                                                                            | "gXc5UCLnM6ckD7pjM1TdPA=="            |                                          |
| eci_value                 | String         | No       | Electronic Commerce Indicator / Security Level Indicator provided with network tokens.                                                                              | "07"                                  |                                          |
| checks_performed          | List\<String\> | No       | Checks already performed on the card.                                                                                                                               | \[avs, cvv, ani, auth0\]              |                                          |
| iin                       | String         | No       | Institution Identification Number (aka BIN). The first 6 digits on a card identifying the issuer.                                                                   | "123456"                              | Max. length 6                            |
| display_card_funding_type | String enum    | Yes      | Funding type of the card to display.                                                                                                                                | “credit” or “debit” or “prepaid”      | Must be “credit” or “debit” or “prepaid” |
| display_wallet_type       | String         | No       | If the card came via a digital wallet, what type of wallet.                                                                                                         | “wallet”                              |                                          |
| display_brand             | String         | No       | Brand of the card to display.                                                                                                                                       | “Visa”, “amex”, “discover”            |                                          |
| display_last4             | String         | No       | In case of non-PAN, this is the original last 4 digits of the card for customer display.                                                                            | "1234"                                | Max. length 4                            |
| metadata                  | Object (map)   | Yes      | Arbitrary key/value pairs.                                                                                                                                          | Example:`{ “issuing\_bank”: “temp” }` |                                          |

### Address

| Field       | Type   | Required | Description                                | Example         | Validation                            |
| ----------- | :----- | :------- | ------------------------------------------ | --------------- | ------------------------------------- |
| name        | String | Yes      | Customer name                              | “John Doe”      | Max. length 256                       |
| line_one    | String | Yes      | Street line 1                              | "123 Fake St."  | Max. length 60                        |
| line_two    | String | No       | Street line 2                              | "Unit 1"        | Max. length 60                        |
| city        | String | Yes      | City                                       | "San Francisco" | Max. length 60                        |
| state       | String | No       | State/region (ISO‑3166‑2 where applicable) | "CA"            | Should follow the ISO 3166-2 standard |
| country     | String | Yes      | ISO‑3166‑1 alpha‑2                         | "US"            | Should follow the ISO 3166-1 standard |
| postal_code | String | Yes      | Postal/ZIP code                            | "12345"         | Max. length 20                        |

### Allowance

| Field               | Type        | Required | Description                                      | Example                                                                      | Validation                                        |
| ------------------- | :---------- | :------- | ------------------------------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------- |
| reason              | String enum | Yes      | Current possible values: “one_time”              | “one_time”: should not be used again for other flows. Usage upto max amount. | Must be one_time                                  |
| max_amount          | int         | Yes      | Max amount the payment method can be charged for | checkout_total                                                               |                                                   |
| currency            | String      | Yes      | currency                                         | ISO-4217 (e.g., “USD”).                                                      | Should follow the ISO 4217 standard in lower case |
| checkout_session_id | String      | Yes      | Reference to checkout_session_id                 | "1PQrsT..."                                                                  |                                                   |
| merchant_id         | String      | Yes      | Merchant identifying descriptor                  | XX                                                                           | Max. length 256                                   |
| expires_at          | String      | Yes      | Time formatted as an RFC 3339 string             | “2025-10-09T07:20:50.52Z”                                                    | Should follow RFC 3339 standard                   |

### Risk Signal

| Field  | Type        | Required | Description                | Example                                | Validation |
| ------ | :---------- | :------- | -------------------------- | :------------------------------------- | :--------- |
| type   | String enum | Yes      | The type of risk signal    | “card_testing”                         | None       |
| score  | int         | Yes      | Details of the risk signal | 10                                     | None       |
| action | String enum | Yes      | Action taken               | “blocked” “manual_review” “authorized” | None       |# Product Feed Spec

## Overview

The Product Feed Specification defines how merchants share structured product data with OpenAI so ChatGPT can accurately surface their products in search and shopping experiences.

**How it works**

1. Prepare your feed. Format your catalog using the Product Feed Spec (see Field reference for required and optional attributes with sample values).
2. Deliver the feed. Share the feed using the preferred delivery method and file format described in the integration section.
3. Ingestion and indexing. OpenAI ingests the feed, validates records, and indexes product metadata for retrieval and ranking in ChatGPT.
4. Keep it fresh. Update the feed whenever products, pricing, or availability change to ensure users see accurate information.

**Key points**

- **Structured source of truth**. OpenAI relies on merchant-provided feeds—this ensures accurate pricing, availability, and other key details.
- **Built for discovery**. The feed powers product matching, indexing, and ranking in ChatGPT.
- **Integration guidance**. The spec defines the preferred delivery method and file format for reliable ingestion.
- **Field reference**. A complete list of required and optional attributes (with examples) is provided to help you validate your feed.
- **Freshness matters**. Frequent updates improve match quality and reduce out-of-stock or price-mismatch scenarios.

## Integration Overview

This section outlines the key logistics: how the feed is delivered, acceptable file formats, and the initial steps required to validate your data, so engineering teams can plan with confidence.

<table>
  <colgroup>
    <col style="width: 220px;" />
    <col />
  </colgroup>
  <thead>
    <tr>
      <th>Topic</th>
      <th>Details</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Delivery model</td>
      <td>
        Merchants push feeds to OpenAI via SFTP, file upload, or hosted URL.
      </td>
    </tr>
    <tr>
      <td>File format</td>
      <td>Supported formats are `jsonl.gz` and `csv.gz` (gzip-compressed).</td>
    </tr>
    <tr>
      <td>Refresh Frequency</td>
      <td>Our system accepts updates daily.</td>
    </tr>
  </tbody>
</table>

## Field Reference

To make your products discoverable inside ChatGPT, merchants provide a structured product feed that OpenAI ingests and indexes. This specification defines the complete schema: field names, data types, constraints, and example values needed for accurate search, pricing, and checkout experiences.

Each table below groups attributes by category (Basic Data, Media, Pricing, etc.) and clearly indicates whether a field is Required, Recommended, or Optional, along with validation rules to help your engineering team build and maintain a compliant feed.

Supplying all required fields ensures your products can be displayed correctly, while recommended fields enrich relevance and user trust.

<div id="field-reference-content">

### OpenAI Flags

Use these flags to control whether a product is discoverable and/or purchasable inside ChatGPT. These fields do not affect how the product is displayed on your own site, they simply enable or disable the ChatGPT integrations.

| Attribute            | Data Type | Supported Values | Description                                                                                                                                        | Example | Requirement | Dependencies                       | Validation Rules  |
| :------------------- | :-------- | :--------------- | :------------------------------------------------------------------------------------------------------------------------------------------------- | :------ | :---------- | :--------------------------------- | :---------------- |
| is_eligible_search   | Boolean   | `true`, `false`  | Controls whether the product can be surfaced in ChatGPT search results.                                                                            | `true`  | Required    | —                                  | Lower-case string |
| is_eligible_checkout | Boolean   | `true`, `false`  | Allows direct purchase inside ChatGPT. <br/>`is_eligible_search` must be `true` in order for `is_eligible_checkout` to be enabled for the product. | `true`  | Required    | Requires `is_eligible_search=true` | Lower-case string |

### Basic Product Data

Provide the core identifiers and descriptive text needed to uniquely reference each product. These fields establish the canonical record that ChatGPT Search uses to display and link to your product.

| Attribute   | Data Type             | Supported Values | Description                              | Example                                      | Requirement | Dependencies | Validation Rules                            |
| :---------- | :-------------------- | :--------------- | :--------------------------------------- | :------------------------------------------- | :---------- | :----------- | :------------------------------------------ |
| item_id     | String (alphanumeric) | —                | Merchant product ID (unique per variant) | `SKU12345`                                   | Required    | —            | Max 100 chars; must remain stable over time |
| gtin        | String (numeric)      | GTIN, UPC, ISBN  | Universal product identifier             | `123456789543`                               | Optional    | —            | 8–14 digits; no dashes or spaces            |
| mpn         | String (alphanumeric) | —                | Manufacturer part number                 | `GPT5`                                       | Optional    | —            | Max 70 chars                                |
| title       | String (UTF-8 text)   | —                | Product title                            | `Men's Trail Running Shoes Black`            | Required    | —            | Max 150 chars; avoid all-caps               |
| description | String (UTF-8 text)   | —                | Full product description                 | `Waterproof trail shoe with cushioned sole…` | Required    | —            | Max 5,000 chars; plain text only            |
| url         | URL                   | RFC 1738         | Product detail page URL                  | `https://example.com/product/SKU12345`       | Required    | —            | Must resolve with HTTP 200; HTTPS preferred |

### Item Information

Capture the physical characteristics and classification details of the product. This data helps ensure accurate categorization, filtering, and search relevance.

| Attribute        | Data Type | Supported Values                                | Description          | Example                         | Requirement | Dependencies                                                | Validation Rules                    |
| :--------------- | :-------- | :---------------------------------------------- | :------------------- | :------------------------------ | :---------- | :---------------------------------------------------------- | :---------------------------------- |
| condition        | String    | —                                               | Condition of product | `new`                           | Optional    | —                                                           | Lower-case string                   |
| product_category | String    | Category taxonomy                               | Category path        | `Apparel & Accessories > Shoes` | Optional    | —                                                           | Use “>” separator                   |
| brand            | String    | —                                               | Product brand        | `OpenAI`                        | Required    | —                                                           | Max 70 chars                        |
| material         | String    | —                                               | Primary material(s)  | `Leather`                       | Optional    | —                                                           | Max 100 chars                       |
| dimensions       | String    | `LxWxH unit`                                    | Overall dimensions   | `12x8x5 in`                     | Optional    | —                                                           | Units required if provided          |
| length           | String    | —                                               | Individual dimension | `10`                            | Optional    | Provide all three if using individual fields                | Use `dimensions_unit`               |
| width            | String    | —                                               | Individual dimension | `10`                            | Optional    | Provide all three if using individual fields                | Use `dimensions_unit`               |
| height           | String    | —                                               | Individual dimension | `10`                            | Optional    | Provide all three if using individual fields                | Use `dimensions_unit`               |
| dimensions_unit  | String    | —                                               | Dimensions unit      | `in`                            | Optional    | Required if any of `length`, `width`, `height` are provided | Unit abbreviation (e.g. `in`, `cm`) |
| weight           | String    | —                                               | Product weight       | `1.5`                           | Optional    | —                                                           | Use `item_weight_unit`              |
| item_weight_unit | String    | —                                               | Product weight unit  | `lb`                            | Optional    | Required if `weight` is provided                            | Unit abbreviation (e.g. `lb`, `kg`) |
| age_group        | Enum      | `newborn`, `infant`, `toddler`, `kids`, `adult` | Target demographic   | `adult`                         | Optional    | —                                                           | Lower-case string                   |

### Media

Supply visual and rich media assets that represent the product. High-quality images and optional videos or 3D models improve user trust and engagement.

| Attribute             | Data Type | Supported Values | Description            | Example                            | Requirement | Dependencies | Validation Rules            |
| :-------------------- | :-------- | :--------------- | :--------------------- | :--------------------------------- | :---------- | :----------- | :-------------------------- |
| image_url             | URL       | RFC 1738         | Main product image URL | `https://example.com/image1.jpg`   | Required    | —            | JPEG/PNG; HTTPS preferred   |
| additional_image_urls | String    | —                | Extra images           | `https://example.com/image2.jpg,…` | Optional    | —            | Comma-separated list        |
| video_url             | URL       | RFC 1738         | Product video          | `https://youtu.be/12345`           | Optional    | —            | Must be publicly accessible |
| model_3d_url          | URL       | RFC 1738         | 3D model               | `https://example.com/model.glb`    | Optional    | —            | GLB/GLTF preferred          |

### Price & Promotions

Define standard and promotional pricing information. These attributes power price display, discount messaging, and offer comparisons.

| Attribute                           | Data Type         | Supported Values | Description               | Example                    | Requirement | Dependencies | Validation Rules              |
| :---------------------------------- | :---------------- | :--------------- | :------------------------ | :------------------------- | :---------- | :----------- | :---------------------------- |
| price                               | Number + currency | ISO 4217         | Regular price             | `79.99 USD`                | Required    | —            | Must include currency code    |
| sale_price                          | Number + currency | ISO 4217         | Discounted price          | `59.99 USD`                | Optional    | —            | Must be ≤ `price`             |
| sale_price_start_date               | Date              | ISO 8601         | Sale start date           | `2025-07-01`               | Optional    | —            | Must be valid ISO 8601 date   |
| sale_price_end_date                 | Date              | ISO 8601         | Sale end date             | `2025-07-15`               | Optional    | —            | Must be valid ISO 8601 date   |
| unit_pricing_measure / base_measure | Number + unit     | —                | Unit price & base measure | `16 oz / 1 oz`             | Optional    | —            | Both fields required together |
| pricing_trend                       | String            | —                | Lowest price in N months  | `Lowest price in 6 months` | Optional    | —            | Max 80 chars                  |

### Availability & Inventory

Describe current stock levels and key timing signals for product availability. Accurate inventory data ensures users only see items they can actually purchase.

| Attribute         | Data Type         | Supported Values                                                | Description                    | Example      | Requirement                          | Dependencies             | Validation Rules        |
| :---------------- | :---------------- | :-------------------------------------------------------------- | :----------------------------- | :----------- | :----------------------------------- | :----------------------- | :---------------------- |
| availability      | Enum              | `in_stock`, `out_of_stock`, `pre_order`, `backorder`, `unknown` | Product availability           | `in_stock`   | Required                             | —                        | Lower-case string       |
| availability_date | Date              | ISO 8601                                                        | Availability date if pre-order | `2025-12-01` | Required if `availability=pre_order` | —                        | Must be future date     |
| expiration_date   | Date              | ISO 8601                                                        | Remove product after date      | `2025-12-01` | Optional                             | —                        | Must be future date     |
| pickup_method     | Enum              | `in_store`, `reserve`, `not_supported`                          | Pickup options                 | `in_store`   | Optional                             | —                        | Lower-case string       |
| pickup_sla        | Number + duration | —                                                               | Pickup SLA                     | `1 day`      | Optional                             | Requires `pickup_method` | Positive integer + unit |

### Variants

Specify variant relationships and distinguishing attributes such as color or size. These fields allow ChatGPT to group related SKUs and surface variant-specific details.

The group_id value should represent how the product is presented on the merchant’s website (the canonical product page or parent listing shown to customers). If you are submitting variant rows (e.g., by color or size), you must include the same group_id for every variant. Do not submit individual variant SKUs without a group id.

| Attribute                | Data Type           | Supported Values | Description                             | Example                             | Requirement           | Dependencies | Validation Rules               |
| :----------------------- | :------------------ | :--------------- | :-------------------------------------- | :---------------------------------- | :-------------------- | :----------- | :----------------------------- |
| group_id                 | String              | —                | Variant group ID                        | `SHOE123GROUP`                      | Required              | —            | Max 70 chars                   |
| listing_has_variations   | Boolean             | `true`, `false`  | Indicates if the listing has variations | `true`                              | Required              | —            | Lower-case string              |
| variant_dict             | Object              | —                | Variant attributes map                  | `{ "color": "Blue", "size": "10" }` | Optional              | —            | JSON object with string values |
| item_group_title         | String (UTF-8 text) | —                | Group product title                     | `Men's Trail Running Shoes`         | Optional              | —            | Max 150 chars; avoid all-caps  |
| color                    | String              | —                | Variant color                           | `Blue`                              | Optional              | —            | Max 40 chars                   |
| size                     | String              | —                | Variant size                            | `10`                                | Recommended (apparel) | —            | Max 20 chars                   |
| size_system              | Country code        | ISO 3166         | Size system                             | `US`                                | Recommended (apparel) | —            | 2-letter country code          |
| gender                   | String              | —                | Gender target                           | `male`                              | Optional              | —            | Lower-case string              |
| offer_id                 | String              | —                | Offer ID (SKU+seller+price)             | `SKU12345-Blue-79.99`               | Recommended           | —            | Unique within feed             |
| Custom_variant1_category | String              | —                | Custom variant dimension 1              | Size_Type                           | Optional              | —            | —                              |
| Custom_variant1_option   | String              | —                | Custom variant 1 option                 | Petite / Tall / Maternity           | Optional              | —            | —                              |
| Custom_variant2_category | String              | —                | Custom variant dimension 2              | Wood_Type                           | Optional              | —            | —                              |
| Custom_variant2_option   | String              | —                | Custom variant 2 option                 | Oak / Mahogany / Walnut             | Optional              | —            | —                              |
| Custom_variant3_category | String              | —                | Custom variant dimension 3              | Cap_Type                            | Optional              | —            | —                              |
| Custom_variant3_option   | String              | —                | Custom variant 3 option                 | Snapback / Fitted                   | Optional              | —            | —                              |

### Fulfillment

Outline shipping methods, costs, and estimated delivery times. Providing detailed shipping information helps users understand fulfillment options upfront.

| Attribute         | Data Type | Supported Values                   | Description                         | Example                     | Requirement | Dependencies | Validation Rules                               |
| :---------------- | :-------- | :--------------------------------- | :---------------------------------- | :-------------------------- | :---------- | :----------- | :--------------------------------------------- |
| shipping_price    | String    | country:region:service_class:price | Shipping method/cost/region         | `US:CA:Overnight:16.00 USD` | Optional    | —            | Multiple entries allowed; use colon separators |
| delivery_estimate | Date      | ISO 8601                           | Estimated arrival date              | `2025-08-12`                | Optional    | —            | Must be future date                            |
| is_digital        | Boolean   | `true`, `false`                    | Indicates if the product is digital | `false`                     | Optional    | —            | Lower-case string                              |

### Merchant Info

Identify the seller and link to any relevant merchant policies or storefront pages. This ensures proper attribution and enables users to review seller credentials.

Note about 3P sellers and marketplaces: If your feed contains products that are shipped with 3rd party sellers, please also include a marketplace_seller in your feed. The marketplace_seller would be the point of checkout in this scenario, and the seller_name would be the shipment fulfiller.

| Attribute             | Data Type | Supported Values | Description                      | Example                       | Requirement                              | Dependencies | Validation Rules |
| :-------------------- | :-------- | :--------------- | :------------------------------- | :---------------------------- | :--------------------------------------- | :----------- | :--------------- |
| seller_name           | String    | —                | Seller name                      | `Example Store`               | Required / Display                       | —            | Max 70 chars     |
| marketplace_seller    | String    | —                | Marketplace seller of record     | `Marketplace Name`            | Optional                                 | —            | Max 70 chars     |
| seller_url            | URL       | RFC 1738         | Seller page                      | `https://example.com/store`   | Required                                 | —            | HTTPS preferred  |
| seller_privacy_policy | URL       | RFC 1738         | Seller-specific policies         | `https://example.com/privacy` | Required if is_eligible_checkout is true | —            | HTTPS preferred  |
| seller_tos            | URL       | RFC 1738         | Seller-specific terms of service | `https://example.com/terms`   | Required if is_eligible_checkout is true | —            | HTTPS preferred  |

### Returns

Provide return policies and time windows to set clear expectations for buyers. Transparent return data builds trust and reduces post-purchase confusion.

Use `return_deadline_in_days` as the canonical field for return windows in the feed schema.

| Attribute               | Data Type | Supported Values | Description             | Example                       | Requirement | Dependencies | Validation Rules  |
| :---------------------- | :-------- | :--------------- | :---------------------- | :---------------------------- | :---------- | :----------- | :---------------- |
| accepts_returns         | Boolean   | `true`, `false`  | Accepts returns         | `true`                        | Optional    | —            | Lower-case string |
| return_deadline_in_days | Integer   | Days             | Days allowed for return | `30`                          | Optional    | —            | Positive integer  |
| accepts_exchanges       | Boolean   | `true`, `false`  | Accepts exchanges       | `false`                       | Optional    | —            | Lower-case string |
| return_policy           | URL       | RFC 1738         | Return policy URL       | `https://example.com/returns` | Required    | —            | HTTPS preferred   |

### Performance Signals

Share popularity and return-rate metrics where available. These signals can be used to enhance ranking and highlight high-performing products.

| Attribute        | Data Type | Supported Values | Description          | Example | Requirement | Dependencies | Validation Rules              |
| :--------------- | :-------- | :--------------- | :------------------- | :------ | :---------- | :----------- | :---------------------------- |
| popularity_score | Number    | —                | Popularity indicator | `4.7`   | Recommended | —            | 0–5 scale or merchant-defined |
| return_rate      | Number    | Percentage       | Return rate          | `2%`    | Recommended | —            | 0–100%                        |

### Compliance

Include regulatory warnings, disclaimers, or age restrictions. Compliance fields help meet legal obligations and protect consumers.

| Attribute             | Data Type    | Supported Values | Description          | Example                                           | Requirement              | Dependencies | Validation Rules              |
| :-------------------- | :----------- | :--------------- | :------------------- | :------------------------------------------------ | :----------------------- | :----------- | :---------------------------- |
| warning / warning_url | String / URL | —                | Product disclaimers  | `Contains lithium battery, or CA Prop 65 warning` | Recommended for Checkout | —            | If URL, must resolve HTTP 200 |
| age_restriction       | Number       | —                | Minimum purchase age | `21`                                              | Recommended              | —            | Positive integer              |

### Reviews and Q&A

Supply aggregated review statistics and frequently asked questions. User-generated insights strengthen credibility and help shoppers make informed decisions.

| Attribute          | Data Type | Supported Values | Description                   | Example                                                                                              | Requirement | Dependencies | Validation Rules                                                                                                     |
| :----------------- | :-------- | :--------------- | :---------------------------- | :--------------------------------------------------------------------------------------------------- | :---------- | :----------- | :------------------------------------------------------------------------------------------------------------------- |
| review_count       | Integer   | —                | Number of product reviews     | `254`                                                                                                | Optional    | —            | Non-negative                                                                                                         |
| star_rating        | String    | —                | Average review score          | `4.50`                                                                                               | Optional    | —            | 0–5 scale                                                                                                            |
| store_review_count | Integer   | —                | Number of brand/store reviews | `2000`                                                                                               | Optional    | —            | Non-negative                                                                                                         |
| store_star_rating  | String    | —                | Average store rating          | `4.50`                                                                                               | Optional    | —            | 0–5 scale                                                                                                            |
| q_and_a            | List      | —                | FAQ content                   | `[{ "q": "Is this waterproof?", "a": "Yes" }]`                                                       | Recommended | —            | List of `{ "q": string, "a": string }` objects                                                                       |
| reviews            | List      | —                | Review entries                | `[{ "title": "Love these", "content": "Great grip.", "minRating": 1, "maxRating": 5, "rating": 5 }]` | Recommended | —            | List of `{ "title": string, "content": string, "minRating": number, "maxRating": number, "rating": number }` objects |

### Related Products

List products that are commonly bought together or act as substitutes. This enables basket-building recommendations and cross-sell opportunities.

| Attribute          | Data Type | Supported Values                                                                                  | Description            | Example       | Requirement | Dependencies | Validation Rules             |
| :----------------- | :-------- | :------------------------------------------------------------------------------------------------ | :--------------------- | :------------ | :---------- | :----------- | :--------------------------- |
| related_product_id | String    | —                                                                                                 | Associated product IDs | `SKU67890`    | Recommended | —            | Comma-separated list allowed |
| relationship_type  | Enum      | `part_of_set`, `required_part`, `often_bought_with`, `substitute`, `different_brand`, `accessory` | Relationship type      | `part_of_set` | Recommended | —            | Lower-case string            |

### Geo Tagging

Indicate any region-specific pricing or availability overrides. Geo data allows ChatGPT to present accurate offers and stock status by location.

| Attribute        | Data Type         | Supported Values             | Description                                     | Example                                     | Requirement | Dependencies | Validation Rules                     |
| :--------------- | :---------------- | :--------------------------- | :---------------------------------------------- | :------------------------------------------ | :---------- | :----------- | :----------------------------------- |
| target_countries | List              | `US`                         | Target countries of the item (first entry used) | `US`                                        | Required    | —            | Use ISO 3166-1 alpha-2 codes         |
| store_country    | String            | `US`                         | Store country of the item                       | `US`                                        | Required    | —            | Use ISO 3166-1 alpha-2 codes         |
| geo_price        | Number + currency | Region-specific price        | Price by region                                 | `79.99 USD (California)`                    | Recommended | —            | Must include ISO 4217 currency       |
| geo_availability | String            | Region-specific availability | Availability per region                         | `in_stock (Texas), out_of_stock (New York)` | Recommended | —            | Regions must be valid ISO 3166 codes |

## Prohibited Products Policy

To keep ChatGPT a safe place for everyone, we only allow products and services that are legal, safe, and appropriate for a general audience. Prohibited products include, but are not limited to, those that involve adult content, age-restricted products (e.g., alcohol, nicotine, gambling), harmful or dangerous materials, weapons, prescription only medications, unlicensed financial products, legally restricted goods, illegal activities, or deceptive practices.

Merchants are responsible for ensuring their products and content do not violate the above restrictions or any applicable law. OpenAI may take corrective actions such as removing a product or banning a seller from being surfaced in ChatGPT if these policies are violated.

</div>|