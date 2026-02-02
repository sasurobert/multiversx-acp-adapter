import request from "supertest";
import { app } from "../app";
import { Mnemonic, UserSigner } from "@multiversx/sdk-wallet";
import { Transaction, Address, TransactionComputer } from "@multiversx/sdk-core";
import { RelayerService } from "../logic/relayer";

describe("Relayed Payment Integration (V2)", () => {
    // Relayer (Adapter) Key - Must match what the App uses or we mock env
    const relayerMnemonic = Mnemonic.generate();
    const relayerKey = relayerMnemonic.deriveKey(0);
    const relayerAddress = relayerKey.generatePublicKey().toAddress().bech32();

    // User (Agent) Key
    const userMnemonic = Mnemonic.generate();
    const userKey = userMnemonic.deriveKey(0);
    const userAddress = userKey.generatePublicKey().toAddress().bech32();
    const userSigner = new UserSigner(userKey);

    beforeAll(() => {
        process.env.RELAYER_SECRET_KEY = relayerKey.hex();
        process.env.RELAYER_ADDRESS = relayerAddress;
        process.env.TEST_MODE = "true"; // Start with mock mode for safety
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
            .post("/delegate_payment")
            .send(payload)
            .expect(200);

        expect(res1.body.payment_token).toBeDefined();
        const paymentToken = res1.body.payment_token;

        // 3. Trigger /capture
        const res2 = await request(app)
            .post("/capture")
            .send({ payment_token: paymentToken })
            .expect(200);

        expect(res2.body.status).toBe("processing");
        expect(res2.body.tx_hash).toMatch(/^0x[a-f0-9]+$/);
    });
});
