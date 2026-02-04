import { describe, it, expect, jest } from "@jest/globals";
import { RelayerService } from "../logic/relayer";
import { Transaction, Address, TransactionComputer, AddressComputer } from "@multiversx/sdk-core";
import { Mnemonic, UserSigner, UserSecretKey } from "@multiversx/sdk-wallet";
import { env } from "../utils/environment";

jest.mock("../utils/environment", () => ({
    env: {
        MARKETPLACE_ADDRESS: "erd1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6gq4hu",
        API_URL: "https://devnet-api.multiversx.com",
        CHAIN_ID: "D",
        GAS_LIMIT: 60000000,
        // Mock 32-byte hex keys for each shard
        RELAYER_SECRET_KEY_SHARD_0: "0000000000000000000000000000000000000000000000000000000000000000",
        RELAYER_SECRET_KEY_SHARD_1: "1111111111111111111111111111111111111111111111111111111111111111",
        RELAYER_SECRET_KEY_SHARD_2: "2222222222222222222222222222222222222222222222222222222222222222"
    }
}));

describe("RelayerService", () => {

    // Helper: Find a user in a specific shard
    const findUserInShard = (targetShard: number) => {
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

    // Helper: Derive address from hex key
    const getAddressFromKey = (hexKey: string) => {
        const key = UserSecretKey.fromString(hexKey);
        return key.generatePublicKey().toAddress().bech32();
    };

    it("should pack and sign a Relayed V3 transaction", async () => {
        // Use a Shard 1 user
        const user = findUserInShard(1);
        const userSigner = new UserSigner(user.key);

        // Expected Relayer for Shard 1
        const relayer1Address = getAddressFromKey("1111111111111111111111111111111111111111111111111111111111111111");

        // 1. User constructs Inner Transaction
        // NOTE: In V3, User must sign with 'relayer' field set to the CORRECT Relayer address for their shard
        const innerTx = new Transaction({
            nonce: 10n,
            value: 1000000000000000000n, // 1 EGLD
            receiver: new Address("erd1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6gq4hu"),
            sender: new Address(user.address),
            gasLimit: BigInt(env.GAS_LIMIT),
            chainID: env.CHAIN_ID,
            relayer: new Address(relayer1Address),
            data: Buffer.from("hello")
        });

        // Sign as User
        const computer = new TransactionComputer();
        const serialized = computer.computeBytesForSigning(innerTx);
        innerTx.signature = await userSigner.sign(serialized);

        // 2. Prepare Payload (what the API receives)
        const payload = {
            sender: user.address,
            receiver: innerTx.receiver.toBech32(),
            nonce: Number(innerTx.nonce),
            value: innerTx.value.toString(),
            data: Buffer.from(innerTx.data).toString("base64"),
            signature: Buffer.from(innerTx.signature).toString("hex"),
        };

        // 3. Adapter packs it
        // Verify First
        const isValid = RelayerService.verifySignature(payload);
        expect(isValid).toBe(true);

        const relayedTx = await RelayerService.packRelayedTransaction(payload);

        expect(relayedTx).toBeDefined();
        // Check that the relayer address in the packed tx matches what we expect
        expect(relayedTx.relayer.toBech32()).toBe(relayer1Address);
        expect(relayedTx.signature.length).toBeGreaterThan(0);
        expect(relayedTx.relayerSignature).toBeDefined();
        expect(relayedTx.relayerSignature.length).toBeGreaterThan(0);
    });
});
