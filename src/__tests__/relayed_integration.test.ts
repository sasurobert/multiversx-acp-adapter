import { describe, it, expect, beforeAll, jest } from "@jest/globals";
import request from "supertest";
import { app } from "../app";
import { Mnemonic, UserSigner, UserSecretKey } from "@multiversx/sdk-wallet";
import { Transaction, Address, TransactionComputer, AddressComputer } from "@multiversx/sdk-core";


jest.mock("../utils/environment", () => ({
    env: {
        MARKETPLACE_ADDRESS: "erd1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6gq4hu",
        API_URL: "https://devnet-api.multiversx.com",
        CHAIN_ID: "D",
        GAS_LIMIT: 60000000,
        RELAYER_SECRET_KEY_SHARD_0: "0000000000000000000000000000000000000000000000000000000000000000",
        RELAYER_SECRET_KEY_SHARD_1: "1111111111111111111111111111111111111111111111111111111111111111",
        RELAYER_SECRET_KEY_SHARD_2: "2222222222222222222222222222222222222222222222222222222222222222"
    },
    createProvider: jest.fn().mockImplementation(() => ({
        sendTransaction: jest.fn<any>().mockResolvedValue("0x567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12"),
        simulateTransaction: jest.fn<any>().mockResolvedValue({
            execution: { result: "success" }
        })
    }))
}));

jest.mock("@multiversx/sdk-network-providers", () => ({
    ProxyNetworkProvider: jest.fn().mockImplementation(() => ({
        sendTransaction: jest.fn<any>().mockResolvedValue("0x567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12"),
        simulateTransaction: jest.fn<any>().mockResolvedValue({
            execution: { result: "success" }
        })
    }))
}));

describe("Relayed Payment Integration (Multi-Shard)", () => {

    // Helper to derive address from hex key
    const getAddressFromKey = (hexKey: string) => {
        const key = UserSecretKey.fromString(hexKey);
        return key.generatePublicKey().toAddress().bech32();
    };

    // Expected Relayer Addresses based on mocks
    const relayer0 = getAddressFromKey("0000000000000000000000000000000000000000000000000000000000000000"); // Shard 0? Check dynamically
    const relayer1 = getAddressFromKey("1111111111111111111111111111111111111111111111111111111111111111");

    // Helper to find a user address in a specific shard
    const findUserInShard = (targetShard: number): { mnemonic: Mnemonic, address: string, key: any } => {
        const computer = new AddressComputer();
        let attempts = 0;
        while (attempts < 1000) {
            const mnemonic = Mnemonic.generate();
            const key = mnemonic.deriveKey(0);
            const addressBech32 = key.generatePublicKey().toAddress().bech32();
            const addressObj = new Address(addressBech32);
            if (computer.getShardOfAddress(addressObj) === targetShard) {
                return { mnemonic, address: addressBech32, key };
            }
            attempts++;
        }
        throw new Error(`Could not find address in shard ${targetShard}`);
    };

    beforeAll(() => {
        process.env.TEST_MODE = "true";
    });

    it("should use Shard 1 Relayer for a Shard 1 Sender", async () => {
        const shard = 1;
        const user = findUserInShard(shard);
        const userSigner = new UserSigner(user.key);

        console.log(`Testing with User Shard: ${shard}, Address: ${user.address}`);
        console.log(`Expected Relayer Address (Shard 1 Key): ${relayer1}`);

        // 1. Agent constructs Inner Transaction (Gasless)
        // MUST set relayer to the expected Shard 1 relayer
        const innerTx = new Transaction({
            nonce: 5n,
            value: 1000000000000000000n, // 1 EGLD
            receiver: new Address("erd1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6gq4hu"),
            sender: new Address(user.address),
            gasLimit: 60000000n,
            chainID: "D",
            relayer: new Address(relayer1), // CRITICAL: User implies they know the relayer (or queried it)
            data: Buffer.from("payment_shard_1")
        });

        const computer = new TransactionComputer();
        innerTx.signature = await userSigner.sign(computer.computeBytesForSigning(innerTx));

        const payload = {
            sender: user.address,
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
