# MultiversX ACP Integration Guide

This guide details how to set up the **Agentic Commerce Protocol (ACP)** Adapter to enable OpenAI Agents to buy products from your MultiversX Marketplace.

## Overview

The ACP Adapter acts as a bridge:
*   It exposes a **Product Feed** (`/.well-known/acp/products.json`) capable of querying the MultiversX API.
*   It exposes a **Checkout Endpoint** (`/checkout`) that returns a `use_dapp_wallet` action.

## Integration Steps

### 1. Configuration
The adapter is data-driven. You must configure it to point to your specific Marketplace Contract and the MultiversX public API.

**File**: `src/config.json`

```json
{
  "api_url": "https://api.multiversx.com",
  "marketplace_address": "erd1qqqqqqqqqqqqqpgq72l6vl07fkn3rycn3wwv8mwEy7w2cppr89l2q0",
  "showcase_collection": "MY-COLLECTION-ID"
}
```

*   **`api_url`**: Use `https://devnet-api.multiversx.com` for testing, or Mainnet for production.
*   **`marketplace_address`**: The contract address that will receive the `buy` transaction.
*   **`showcase_collection`**: (Optional) If set, the Product Feed will only show items from this collection. If omitted, it may fetch recent listings.

### 2. Transaction Logic
The adapter assumes a standard `buy` function signature:
`buy @ token_identifier @ nonce @ quantity`

If your contract requires a different signature (e.g. `buyNft`), you must currently modify `src/app.ts` to adjust the `data` construction string:

```typescript
// src/app.ts
const data = `myCustomBuyFunction@${tokenHex}...`;
```

### 3. Agent Integration
To test with an Agent:
1.  Expose the adapter publicly (e.g., using `ngrok` or deploying to AWS/Vercel).
2.  Provide the Base URL to the OpenAI "Actions" configuration or Custom GPT setup.
3.  The Agent will automatically discover the `products.json`.
