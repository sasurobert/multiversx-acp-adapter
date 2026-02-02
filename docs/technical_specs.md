# Technical Specification: MultiversX ACP Adapter Upgrade

**Version**: 1.0.0
**Status**: Draft
**Reference**: [MX-8004-specs](../../mx8004-specs/README.md), [ACP Specs](../../mx8004-specs/acp_multiversx_specs.md)

## 1. Overview
This specification details the upgrade of the `multiversx-acp-adapter` to support **Phase 1: Buyer Mode** of the Agent Commerce Protocol (ACP). This transforms the adapter from a passive product feed into an active agent commerce node capable of negotiation, signing agreements, and managing escrowed payments.

---

## 2. API Specifications

### 2.1. Negotiation Endpoint
**Endpoint**: `POST /negotiate`
**Description**: Accepts a Request for Proposal (RFP) and returns a signed Proof of Agreement (PoA) if terms are acceptable.

**Request Payload (JSON)**:
```json
{
  "rfp_id": "uuid-v4",
  "client_id": "agent-nonce-1234",
  "task_description": "Natural language description or schema ref",
  "budget_limit": "1000000", // in minimal units (e.g. USDC atomic)
  "token_identifier": "USDC-c76f1f",
  "deadline_block": 12345678,
  "min_reputation": 50
}
```

**Response Payload (JSON)**:
```json
{
  "status": "accepted", // or "rejected", "counter_offer"
  "proposal": {
    "job_id": "gen-uuid-5678",
    "price": "500000",
    "token": "USDC-c76f1f",
    "deadline_block": 12345678,
    "vendor_signature": "hex_signature_of_poa_hash"
  },
  "poa_data": {
     // The exact data structure that was signed
     "vendor": "erd1...",
     "client": "erd1...",
     "price": "500000",
     "token": "USDC-c76f1f",
     ...
  }
}
```

### 2.2. Escrow Deposit Builder
**Endpoint**: `POST /checkout` (Enhanced)
**Description**: Generates the transaction payload for depositing funds into the ACP Escrow Contract.

**Request Payload (JSON)**:
```json
{
  "product_id": "service-xyz", // OR
  "job_id": "gen-uuid-5678", // From negotiation
  "type": "escrow" // Explicitly request escrow flow
}
```

**Response Payload (JSON)**:
```json
{
  "status": "requires_action",
  "next_action": {
    "type": "sign_transaction",
    "chain_id": "D", // Devnet
    "receiver": "erd1qqqq...escrow_sc_address",
    "value": "0",
    "gasLimit": 20000000,
    "data": "deposit@<job_id_hex>@<token_hex>@<amount_hex>@<poa_hash>"
  }
}
```

## 3. Logic & Data Structures

### 3.1. Proof of Agreement (PoA)
**Structure**:
The `PoA` is a byte array serialized for signing.
Format: `sha256(job_id + client_address + vendor_address + token + amount + deadline)`

**Signing**:
- The Adapter MUST hold a **Vendor Wallet** (Private Key or Custodial Access) to sign PoAs.
- Key management: `UserSigner.fromPem(process.env.VENDOR_PEM)`

### 3.2. Job State Management
**Storage**: In-memory (MVP) or Redis/Postgres (Production).

**Schema**:
- `job_id`: PK, UUID through.
- `status`: `NEGOTIATED` | `DEPOSITED` | `IN_PROGRESS` | `COMPLETED` | `VERIFIED` | `SETTLED`.
- `rfp_data`: JSON.
- `poa_hash`: string.
- `tx_hash`: string (Deposit TX).

---

## 4. Smart Contract Interactions

### 4.1. Escrow Contract (ACP)
- **Deposit**: `deposit(job_id, poa_hash)`.
    - Adapter monitors for `DepositEvent(job_id)`.
- **Release**: `release(job_id)`.
    - Triggered by Adapter AFTER Validation Oracle failsafe checks.

### 4.2. Validation Registry
- **Submit Proof**: `submitProof(job_id, result_hash)`.
    - Adapter calls this when the off-chain worker completes the task.

---

## 5. Implementation Requirements

### 5.1. Tech Stack
- **Runtime**: Node.js (v18+)
- **SDK**: `@multiversx/sdk-core`, `@multiversx/sdk-wallet`
- **Testing**: `jest`, `hard-hat` style simulations (if possible) or mocked SDK calls.

### 5.2. New Components
1.  **`src/logic/negotiation.ts`**: Handles RFP parsing, pricing logic (dummy for now), and PoA signing.
2.  **`src/logic/escrow.ts`**: Handles TX building for contract interactions.
3.  **`src/logic/validation.ts`**: Handles "Work" simulation and Proof submission.
4.  **`src/worker.ts`**: A background loop to check chain state (Events) for `DEPOSITED` jobs to start working.
