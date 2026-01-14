# MultiversX ACP Adapter Integration Guide

## 1. Overview
The `multiversx-acp-adapter` bridges OpenAI's Agentic Commerce Protocol (ACP) to MultiversX.

## 2. Endpoints (V1 - Standard)
*   `GET /.well-known/acp/products.json`: Returns standard product feed.
*   `POST /checkout`: Returns `dapp_url` for user to sign manually.

## 3. Endpoints (V2 - Relayed)
*   **`POST /delegate_payment`**: Accepts a signed `multiversx_relayed` payload from the Agent.
*   **`POST /capture`**: Broadcasts the transaction to the blockchain using the Adapter as the Relayer (gas sponsor).

## 4. Configuration
Edit `src/config.json`:
```json
{
  "api_url": "https://devnet-api.multiversx.com",
  "marketplace_address": "erd1..."
}
```

## 5. Relayer Setup (V2)
To use the V2 flow, the Adapter must hold EGLD.
1.  Set `RELAYER_PEM` or Private Key env var (implementation detail).
2.  The Adapter uses `UserVerifier` to validate Agent signatures before relaying.
