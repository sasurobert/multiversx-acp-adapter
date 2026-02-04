import { describe, it, expect, beforeAll, jest } from "@jest/globals";
import request from "supertest";
import { app } from "../app";
import { Mnemonic, UserSigner } from "@multiversx/sdk-wallet";
import { Transaction, Address, TransactionComputer } from "@multiversx/sdk-core";


jest.mock("../utils/environment", () => ({
    env: {
        MARKETPLACE_ADDRESS: "erd1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6gq4hu",
        API_URL: "https://devnet-api.multiversx.com",
        CHAIN_ID: "D",
        GAS_LIMIT: 60000000,
        RELAYER_SECRET_KEY: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
    }
}));

jest.mock("@multiversx/sdk-network-providers", () => ({
    ProxyNetworkProvider: jest.fn().mockImplementation(() => ({
        sendTransaction: (jest.fn() as any).mockResolvedValue("0x567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12") // eslint-disable-line @typescript-eslint/no-explicit-any
    }))
}));

describe("Relayed Payment Integration (V2)", () => {
    // Relayer (Adapter) Key - Must match mock
    const relayerAddress = "erd1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6gq4hu";

    // User (Agent) Key
    const userMnemonic = Mnemonic.generate();
    const userKey = userMnemonic.deriveKey(0);
    const userAddress = userKey.generatePublicKey().toAddress().bech32();
    const userSigner = new UserSigner(userKey);

    beforeAll(() => {
        process.env.TEST_MODE = "true";
    });

    it("should process a full delegated payment flow", async () => {
        // 1. Agent constructs Inner Transaction (Gasless)
        const innerTx = new Transaction({
            nonce: 5n,
            value: 1000000000000000000n, // 1 EGLD
            receiver: new Address("erd1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6gq4hu"),
            sender: new Address(userAddress),
            gasLimit: 60000000n, // Must match service
            chainID: "D",
            relayer: new Address(relayerAddress),
            data: Buffer.from("payment_for_job_123")
        });

        const computer = new TransactionComputer();
        innerTx.signature = await userSigner.sign(computer.computeBytesForSigning(innerTx));

        const payload = {
            sender: userAddress,
            receiver: innerTx.receiver.toBech32(),
            nonce: Number(innerTx.nonce),
            value: innerTx.value.toString(),
            data: Buffer.from(innerTx.data).toString("base64"),
            signature: Buffer.from(innerTx.signature).toString("hex")
        };

        // 2. Agent calls /delegate_payment
        const res1 = await request(app)
            .post("/agentic_commerce/delegate_payment")
            .send(payload)
            .expect(201);

        expect(res1.body.id).toBeDefined();
        const paymentToken = res1.body.id;

        // 3. Trigger /capture
        const res2 = await request(app)
            .post("/capture")
            .send({ payment_token: paymentToken })
            .expect(200);

        expect(res2.body.status).toBe("processing");
        expect(res2.body.tx_hash).toMatch(/^0x[a-f0-9]+$/);
    });
});
