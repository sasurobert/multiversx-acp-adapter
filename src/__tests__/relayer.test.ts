import { RelayerService } from "../logic/relayer";
import { Transaction, Address, TransactionComputer } from "@multiversx/sdk-core";
import { Mnemonic, UserSigner } from "@multiversx/sdk-wallet";

describe("RelayerService", () => {
    // Adapter / Relayer Key
    const relayerMnemonic = Mnemonic.generate();
    const relayerKey = relayerMnemonic.deriveKey(0);
    const relayerAddress = relayerKey.generatePublicKey().toAddress().bech32();

    // User / Agent Key
    const userMnemonic = Mnemonic.generate();
    const userKey = userMnemonic.deriveKey(0);
    const userAddress = userKey.generatePublicKey().toAddress().bech32();
    const userSigner = new UserSigner(userKey);

    beforeAll(() => {
        // Build payload signed by User, targeting Relayer
    });

    it("should pack and sign a Relayed V3 transaction", async () => {
        // 1. User constructs Inner Transaction
        // NOTE: In V3, User must sign with 'relayer' field set to Adapter's address
        const innerTx = new Transaction({
            nonce: 10n,
            value: 1000000000000000000n, // 1 EGLD
            receiver: new Address("erd1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6gq4hu"),
            sender: new Address(userAddress),
            gasLimit: 60000000n,
            chainID: "D",
            relayer: new Address(relayerAddress),
            data: Buffer.from("hello") // Try passing Buffer directly
        });

        // Sign as User
        const computer = new TransactionComputer();
        const serialized = computer.computeBytesForSigning(innerTx);
        innerTx.signature = await userSigner.sign(serialized);

        // 2. Prepare Payload (what the API receives)
        const payload = {
            sender: userAddress,
            receiver: innerTx.receiver.toBech32(),
            nonce: Number(innerTx.nonce), // Payload uses number
            value: innerTx.value.toString(),
            data: Buffer.from(innerTx.data).toString("base64"),
            signature: Buffer.from(innerTx.signature).toString("hex"),
        };

        // 3. Adapter packs it
        process.env.RELAYER_SECRET_KEY = relayerKey.hex();
        process.env.RELAYER_ADDRESS = relayerAddress;

        // Verify First
        const isValid = RelayerService.verifySignature(payload);
        expect(isValid).toBe(true);

        const relayedTx = await RelayerService.packRelayedTransaction(payload);

        expect(relayedTx).toBeDefined();
        // Expect Relayer Signature
        expect(relayedTx.signature.length).toBeGreaterThan(0);
        // relayerSignature property check
        expect(relayedTx.relayerSignature).toBeDefined();
        expect(relayedTx.relayerSignature.length).toBeGreaterThan(0);
    });
});
