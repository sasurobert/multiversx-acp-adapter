# ACP Adapter Upgrade Implementation Plan

**Goal:** Transform the `multiversx-acp-adapter` from a static feed into an active Agent Commerce Node supporting Negotiation (RFP), Escrow, and Validation.

**Architecture:** 
- **API Layer**: Express.js endpoints for `/negotiate` and updated `/checkout`.
- **Logic Layer**: Modular services (`negotiation.ts`, `escrow.ts`) using `@multiversx/sdk-core`.
- **State**: In-memory store (MVP) for Job IDs.

**Tech Stack:** TypeScript, Express, MultiversX SDK (Core/Wallet), Jest.

---

### Task 1: Negotiation Logic (RFP & PoA Factory)

**Files:**
- Create: `src/logic/negotiation.ts`
- Test: `src/__tests__/negotiation.test.ts`

**Step 1.1: Write failing test for `createProposal`**
Create a test that mocks an RFP and expects a signed Proposal with a valid `vendor_signature`.

**Step 1.2: Implement `createProposal`**
- Import `UserSigner` (mock key for dev).
- Implement `calculatePrice(rfp)` (simple 1:1 mapping for now).
- Generate `job_id`.
- Hash the PoA data.
- Sign the hash.
- Return the partial Proposal object.

**Step 1.3: Verify Signature in Test**
Ensure the returned signature can be verified against the mock public key using `UserVerifier`.

### Task 2: Negotiation Endpoint (`POST /negotiate`)

**Files:**
- Modify: `src/app.ts`
- Test: `src/__tests__/app.test.ts`

**Step 2.1: Write failing integration test**
`POST /negotiate` with valid RFP JSON -> Expect 200 OK + JSON Proposal.

**Step 2.2: Implement Route**
- Parse body.
- Call `NegotiationService.createProposal`.
- Store `job_id` in global store (MVP).
- Return JSON.

**Step 2.3: Validate Error Handling**
Test missing fields in RFP -> Expect 400.

### Task 3: Escrow Transaction Builder

**Files:**
- Create: `src/logic/escrow.ts`
- Test: `src/__tests__/escrow.test.ts`

**Step 3.1: Write failing test for `buildDepositTx`**
Input: `job_id`, `amount`.
Output: "deposit@..." data string.

**Step 3.2: Implement `buildDepositTx`**
- Use `SmartContract.call` logic or manual string construction.
- `deposit @ hex(job_id) @ hex(token) @ hex(amount) @ hex(poa_hash)`.

### Task 4: Checkout Endpoint Upgrade (`POST /checkout`)

**Files:**
- Modify: `src/app.ts`
- Test: `src/__tests__/app.test.ts`

**Step 4.1: Write failing test for Escrow/Job Flow**
`POST /checkout` with `{ "job_id": "...", "type": "escrow" }`.
Expect: `next_action` with `data` starting with `deposit@`.

**Step 4.2: Implement Conditional Logic**
- If `type === 'escrow'`, look up `job_id` in store.
- Retrieve `poa_hash` and `price`.
- Call `EscrowService.buildDepositTx`.
- Return "requires_action".

### Task 5: Validation/Worker Stub

**Files:**
- Create: `src/logic/validation.ts`
- Test: `src/__tests__/validation.test.ts`

**Step 5.1: Write test for `generateProof`**
Input: `job_id`.
Output: Mock hash.

**Step 5.2: Implement `generateProof`**
- Return simple hash of `job_id + "DONE"`.

**Step 5.3: Integrate Stub into /capture (Optional)**
For now, we might not need an endpoint, but a function we can call manually or via a debug endpoint to simulate "Job Done".
