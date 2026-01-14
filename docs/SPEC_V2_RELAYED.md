# ACP V2 Specification: MultiversX Relayed

## 1. Overview
This specification defines the "Relayed V3" architecture for the Agentic Commerce Protocol (ACP) on MultiversX. It shifts from a "Client-Side Handoff" to a **"Delegated Payment"** model where the Agent signs a transaction, and the PSP Adapter (acting as a Relayer) broadcasts it, paying the gas.

## 2. Payment Method Definition
We propose a new type: `multiversx_relayed`.

```json
{
  "type": "multiversx_relayed",
  "fields": {
    "sender": "string (erd1...)",
    "receiver": "string (erd1...)",
    "nonce": "integer",
    "value": "string (atomic units)",
    "token_identifier": "string (optional)",
    "data": "string (base64)",
    "signature": "string (hex)",
    "chain_id": "string (multiversx:1)"
  }
}
```

## 3. PSP Adapter Architecture (V2)

The `multiversx-acp-adapter` must evolve into a **Transaction Relayer Service**.

### 3.1. Endpoints

#### `POST /delegate_payment`
*   **Input**: `multiversx_relayed` object (Signed by Agent).
*   **Logic**:
    1.  Validate `signature` against `sender` address (using `UserVerifier`).
    2.  Use `getAccount(sender)` to verify `nonce` is correct.
    3.  Store the payload in a DB (or ephemeral store) with status `pending_capture`.
    4.  Generate a unique `payment_token` (e.g., `acp_mvx_...`).
*   **Output**: `{ "payment_token": "acp_mvx_..." }`

#### `POST /capture`
*   **Input**: `payment_token`.
*   **Logic**:
    1.  internal: Retrieve the stored payload.
    2.  internal: Construct a `RelayedTransactionV3`.
        *   **Inner Tx**: The User's signed payload.
        *   **Relayer**: The Adapter's Wallet.
    3.  internal: Sign as Relayer.
    4.  internal: Broadcast to Blockchain.
*   **Output**: `{ "status": "processing", "tx_hash": "..." }`

### 3.2. Security
*   **Gas Sponsorship**: The PSP Adapter must hold EGLD. It effectively subsidizes the transaction gas for the user.
*   **Anti-Spam**: The Adapter should implement rate limiting or verify that the `receiver` is a whitelisted Merchant (to prevent abuse of the gas sponsorship).
