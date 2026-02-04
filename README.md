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

## Configuration

Copy `.env.example` to `.env` and configure:

| Variable | Description | Required |
|----------|-------------|----------|
| `MARKETPLACE_ADDRESS` | Smart Contract Address | Yes |
| `VENDOR_ADDRESS` | Vendor Wallet Address | Yes |
| `ESCROW_ADDRESS` | Escrow Contract Address | Yes |
| `RELAYER_SECRET_KEY` | Hex Private Key for Relayer | Yes |
| `VENDOR_SECRET_KEY` | Hex Private Key for Vendor POA | Yes |
| `OPENAI_WEBHOOK_URL` | URL to send order events | No |
| `OPENAI_WEBHOOK_SECRET` | Secret for HMAC signatures | No |
| `API_URL` | MultiversX API (Default: devnet) | No |
| `CHAIN_ID` | Chain ID (Default: D) | No |

## Usage

Start the Adapter Service:
```bash
# Runs on PORT 4000 by default
npm start
# OR for development
npm run dev
```

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/.well-known/acp/products.json` | Product catalogue feed |
| POST | `/checkout_sessions` | Create new checkout session |
| POST | `/checkout_sessions/:id` | Update session (address/items) |
| GET | `/checkout_sessions/:id` | Get session status |
| POST | `/checkout_sessions/:id/complete` | Finalize session & payment |
| POST | `/checkout_sessions/:id/cancel` | Cancel session |
| POST | `/delegate_payment` | Relay gasless transaction (Agent) |
| POST | `/capture` | Broadcast captured payment (Merchant) |

## Testing

Run the integration tests to verify compliance with the ACP spec:
```bash
npm test
npm run test:coverage

## Production Readiness
This project has been audited for compliance and security. See the [Full Report](PRODUCTION_READINESS_REPORT.md).

