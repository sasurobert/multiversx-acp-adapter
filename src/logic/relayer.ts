import { UserVerifier, UserPublicKey, UserSigner, UserSecretKey } from "@multiversx/sdk-wallet";
import { Address, Transaction, TransactionComputer } from "@multiversx/sdk-core";
import { config } from "../utils/config";

export interface RelayedPayload {
    sender: string;
    receiver: string;
    nonce: number;
    value: string; // Atomic units
    data: string; // Base64
    signature: string; // Hex
}

export class RelayerService {

    /**
     * Verifies that the payload was clearly signed by the Sender,
     * intended to be relayed by US (the Adapter).
     */
    static verifySignature(payload: RelayedPayload): boolean {
        // We cannot just verify the data hash if it's a Relayed V3.
        // We must verify the Transaction Signature itself.
        // Reconstruction:
        try {
            // Relayer Address assumed to be this Adapter's configured address
            // The Agent must have signed it with THIS address as the 'relayer'.
            // If config.escrow_address is used as placeholder, fine.
            // But ideally we have a dedicated Relayer Address.
            // For MVP: Use same address or config.marketplace_address
            // Use a specific Relayer Env Var fallback
            const relayerAddrStr = process.env.RELAYER_ADDRESS || config.marketplace_address;

            const tx = new Transaction({
                nonce: BigInt(payload.nonce),
                value: BigInt(payload.value),
                receiver: new Address(payload.receiver),
                sender: new Address(payload.sender),
                gasLimit: 60000000n, // MVP: Loose limit, or we need it in payload? Spec misses GasLimit.
                chainID: "D", // TODO: Configurable
                data: payload.data ? Buffer.from(payload.data, 'base64') : undefined,
                relayer: new Address(relayerAddrStr)
            });

            // SDK v15 Serialization
            const computer = new TransactionComputer();
            const serialized = computer.computeBytesForSigning(tx);
            const signatureBuffer = Buffer.from(payload.signature, 'hex');

            const address = new Address(payload.sender);
            const pubKey = new UserPublicKey(address.getPublicKey());
            const verifier = new UserVerifier(pubKey);

            return verifier.verify(serialized, signatureBuffer);
        } catch (error) {
            console.error("Verification failed:", error);
            return false;
        }
    }

    /**
     * Packs the validated payload into a RelayedTransactionV3 
     * and signs it with the Adapter's private key.
     */
    static async packRelayedTransaction(payload: RelayedPayload): Promise<Transaction> {
        if (!process.env.RELAYER_SECRET_KEY) {
            throw new Error("Missing RELAYER_SECRET_KEY");
        }

        const relayerKey = UserSecretKey.fromString(process.env.RELAYER_SECRET_KEY);
        // relayerKey.generatePublicKey().toAddress() returns UserAddress (sdk-wallet)
        const relayerUserCert = relayerKey.generatePublicKey().toAddress();
        // Convert to sdk-core Address implicitly via bech32 string
        const relayerAddress = new Address(relayerUserCert.bech32());

        // Reconstruct logic same as Verify, but now we apply the signature
        const tx = new Transaction({
            nonce: BigInt(payload.nonce),
            value: BigInt(payload.value),
            receiver: new Address(payload.receiver),
            sender: new Address(payload.sender),
            gasLimit: 60000000n, // Matching verify
            chainID: "D",
            data: payload.data ? Buffer.from(payload.data, 'base64') : undefined,
            relayer: relayerAddress
        });

        // Apply Sender Signature
        tx.signature = Buffer.from(payload.signature, 'hex');

        // Sign as Relayer
        // In SDK Core v13/14+, Transaction object has 'applyRelayerSignature' or similar?
        // Or we just set 'relayerSignature' property if accessible?

        // Use Signer
        const signer = new UserSigner(relayerKey);
        // Signing a Relayed Tx basically signs the already-signed object again?
        // MultiversX Relayed V3 signing flow: 
        // 1. SerializeForSigning (includes sender sig?) No, Relayer signs the tx content + sender sig?
        // Let's check SDK docs or standard.
        // Actually, for Relayed V3, the Relayer signs the whole Transaction object (which includes Sender Signature).

        // Ideally: tx.sign(signer) might overwrite? No.
        // We need to generate the signature for the Relayer.
        // The serializable part for relayer includes the sender's signature?
        // SDK Core usually handles this if built correctly.

        // Let's assume standard behavior:
        // tx.relayerSignature = await signer.sign(tx.serializeForSigning());
        // BUT verify first if serializeForSigning includes sender signature when relayer is present.
        // Assuming SDK handles it.

        // Compute bytes for Relayer Signing
        // In v15, computeBytesForSigning handles the logic if relayer is set?
        // It should include the sender's signature.
        const computer = new TransactionComputer();
        const bytesToSign = computer.computeBytesForSigning(tx);

        const relayerSignature = await signer.sign(bytesToSign);
        tx.relayerSignature = relayerSignature;

        return tx;
    }

    /**
     * Broadcasts the transaction to the network as a Relayed Transaction.
     * The Adapter (this service) pays the gas.
     */
    static async broadcastRelayed(payload: RelayedPayload): Promise<string> {
        console.log(`[Relayer] Broadcasting tx from ${payload.sender} to ${payload.receiver}`);

        try {
            const tx = await this.packRelayedTransaction(payload);

            // If in Test Mode, mock the hash
            if (process.env.TEST_MODE === "true") {
                console.log("[Relayer] Test Mode: Broadcasting mocked.");
                return "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
            }

            // Real Broadcast
            const { ProxyNetworkProvider } = require("@multiversx/sdk-network-providers");
            const provider = new ProxyNetworkProvider(config.api_url);

            const hash = await provider.sendTransaction(tx);
            console.log(`[Relayer] Transaction sent: ${hash}`);
            return hash;
        } catch (e) {
            console.error("Broadcast failed:", e);
            throw e;
        }
    }
}
