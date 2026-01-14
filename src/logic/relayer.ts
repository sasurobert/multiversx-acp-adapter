import { UserVerifier, UserPublicKey } from "@multiversx/sdk-wallet";
import { Address } from "@multiversx/sdk-core";

export interface RelayedPayload {
    sender: string;
    receiver: string;
    nonce: number;
    value: string;
    data: string;
    signature: string; // Hex
}

export class RelayerService {

    /**
     * Verifies that the payload was truly signed by the `sender`.
     */
    static verifySignature(payload: RelayedPayload): boolean {
        try {
            const address = new Address(payload.sender);
            // 'pubkey' exists at runtime but might be private in some TS versions
            const pubKey = new UserPublicKey((address as any).pubkey);
            const verifier = new UserVerifier(pubKey);

            // Expecting the Agent to have signed the Base64 Data buffer directly.
            // In full implementation, this might need to be a serialized Transaction structure.
            const message = Buffer.from(payload.data, 'base64');
            const signatureBuffer = Buffer.from(payload.signature, 'hex');

            return verifier.verify(message, signatureBuffer);
        } catch (error) {
            console.error("Verification failed:", error);
            // Fail safe
            return false;
        }
    }

    /**
     * Broadcasts the transaction to the network as a Relayed Transaction.
     * The Adapter (this service) pays the gas.
     */
    static async broadcastRelayed(payload: RelayedPayload): Promise<string> {
        // 1. In a real env, we would load the Relayer's Private Key (from Env Var)
        // 2. Construct RelayedTransactionV3( innerTx=payload, relayer=me )
        // 3. Sign and Broadcast.

        console.log(`[Relayer] Broadcasting tx from ${payload.sender} to ${payload.receiver}`);

        // Mock TX Hash
        return "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    }
}
