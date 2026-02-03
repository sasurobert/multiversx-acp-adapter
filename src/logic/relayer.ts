import { UserVerifier, UserPublicKey, UserSigner, UserSecretKey } from "@multiversx/sdk-wallet";
import { Address, Transaction, TransactionComputer } from "@multiversx/sdk-core";
import { ProxyNetworkProvider } from "@multiversx/sdk-network-providers";
import { env } from "../utils/environment";

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
        try {
            // Relayer Address assumed to be this Adapter's configured address
            const relayerAddrStr = env.MARKETPLACE_ADDRESS; // Or dedicated env.RELAYER_ADDRESS if added

            const tx = new Transaction({
                nonce: BigInt(payload.nonce),
                value: BigInt(payload.value),
                receiver: new Address(payload.receiver),
                sender: new Address(payload.sender),
                gasLimit: BigInt(env.GAS_LIMIT),
                chainID: env.CHAIN_ID,
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
        const relayerKey = UserSecretKey.fromString(env.RELAYER_SECRET_KEY);
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
            gasLimit: BigInt(env.GAS_LIMIT),
            chainID: env.CHAIN_ID,
            data: payload.data ? Buffer.from(payload.data, 'base64') : undefined,
            relayer: relayerAddress
        });

        // Apply Sender Signature
        tx.signature = Buffer.from(payload.signature, 'hex');

        // Sign as Relayer
        const signer = new UserSigner(relayerKey);

        // Compute bytes for Relayer Signing
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

            // Real Broadcast
            const provider = new ProxyNetworkProvider(env.API_URL);

            const hash = await provider.sendTransaction(tx);
            console.log(`[Relayer] Transaction sent: ${hash}`);
            return hash;
        } catch (e) {
            console.error("Broadcast failed:", e);
            throw e;
        }
    }
}
