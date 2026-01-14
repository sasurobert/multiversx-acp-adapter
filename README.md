# MultiversX ACP Adapter

A lightweight adapter implementing the **OpenAI Agentic Commerce Protocol (ACP)** for MultiversX. 
It bridges the gap between OpenAI Agents and the MultiversX Blockchain by providing standardized Product Feeds and Checkout Actions.

## Capabilities

*   **Agentic Product Feed**: Exposes a standard JSON feed at `/.well-known/acp/products.json` that agents can consume to discover on-chain assets.
*   **Checkout Bridge**: Implements the `POST /checkout` endpoint which constructs MultiversX transaction payloads.
*   **Wallet Handoff**: Returns the `use_dapp_wallet` action, instructing the Agent to hand off the signing process to the user's secure crypto wallet.
*   **Delegated Payments (V2)**: Supports "Gasless" transactions via `POST /delegate_payment`, where the Adapter acts as a Relayer. See [V2 Spec](docs/SPEC_V2_RELAYED.md).

## Installation

```bash
git clone https://github.com/multiversx/multiversx-acp-adapter.git
cd multiversx-acp-adapter
npm install
npm run build
```

## Usage

Start the Adapter Service:
```bash
# Runs on PORT 4000 by default
npm start
```

### Endpoints

| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/.well-known/acp/products.json` | Returns the list of discoverable products. |
| `POST` | `/checkout` | Accepts `{ product_id }` and returns a transaction payload. |
| `POST` | `/delegate_payment` | (V2) Accepts signed `multiversx_relayed` payload from Agent. |
| `POST` | `/capture` | (V2) Broadcasts the relayed transaction to the blockchain. |

## Testing

Run the integration tests to verify compliance with the ACP spec:
```bash
npm test
```
