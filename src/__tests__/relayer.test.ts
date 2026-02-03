import { RelayerService } from "../logic/relayer";
import { Transaction, Address, TransactionComputer } from "@multiversx/sdk-core";
import { Mnemonic, UserSigner } from "@multiversx/sdk-wallet";
import { env } from "../utils/environment";

jest.mock("../utils/environment", () => ({
    env: {
        MARKETPLACE_ADDRESS: "erd1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6gq4hu",
        API_URL: "https://devnet-api.multiversx.com",
        CHAIN_ID: "D",
        GAS_LIMIT: 60000000,
        RELAYER_SECRET_KEY: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
    }
}));

describe("RelayerService", () => {
    // Adapter / Relayer Key (Mocked from ENV)
    const relayerAddress = env.MARKETPLACE_ADDRESS;

    // User / Agent Key
    const userMnemonic = Mnemonic.generate();
    const userKey = userMnemonic.deriveKey(0);
    const userAddress = userKey.generatePublicKey().toAddress().bech32();
    const userSigner = new UserSigner(userKey);

    it("should pack and sign a Relayed V3 transaction", async () => {
        // 1. User constructs Inner Transaction
        // NOTE: In V3, User must sign with 'relayer' field set to Adapter's address
        const innerTx = new Transaction({
            nonce: 10n,
            value: 1000000000000000000n, // 1 EGLD
            receiver: new Address("erd1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6gq4hu"),
            sender: new Address(userAddress),
            gasLimit: BigInt(env.GAS_LIMIT),
            chainID: env.CHAIN_ID,
            relayer: new Address(relayerAddress),
            data: Buffer.from("hello")
        });

        // Sign as User
        const computer = new TransactionComputer();
        const serialized = computer.computeBytesForSigning(innerTx);
        innerTx.signature = await userSigner.sign(serialized);

        // 2. Prepare Payload (what the API receives)
        const payload = {
            sender: userAddress,
            receiver: innerTx.receiver.toBech32(),
            nonce: Number(innerTx.nonce),
            value: innerTx.value.toString(),
            data: Buffer.from(innerTx.data).toString("base64"),
            signature: Buffer.from(innerTx.signature).toString("hex"),
        };

        // 3. Adapter packs it
        // We must ensure the RELAYER_SECRET_KEY in env is valid for signing
        // For the test, we might need to overwrite it if we want to verify the signature later,
        // but RelayerService.packRelayedTransaction uses env.RELAYER_SECRET_KEY.

        // Verify First
        const isValid = RelayerService.verifySignature(payload);
        expect(isValid).toBe(true);

        const relayedTx = await RelayerService.packRelayedTransaction(payload);

        expect(relayedTx).toBeDefined();
        expect(relayedTx.signature.length).toBeGreaterThan(0);
        expect(relayedTx.relayerSignature).toBeDefined();
        expect(relayedTx.relayerSignature.length).toBeGreaterThan(0);
    });
});
