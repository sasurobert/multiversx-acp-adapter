import { UserVerifier, UserPublicKey, UserSigner, UserSecretKey } from "@multiversx/sdk-wallet";
import { Address, Transaction, TransactionComputer, AddressComputer } from "@multiversx/sdk-core";
import { logger } from "../utils/logger";
import { env, createEntrypoint } from "../utils/environment";
import { parseSimulationResult } from "../utils/simulationParser";

interface ISimulationResult {
    status?: { status?: string };
    raw?: {
        status?: string;
        receiverShard?: { status?: string };
        senderShard?: { status?: string };
    };
    execution?: {
        result?: string;
        message?: string;
        gasConsumed?: number;
    };
    result?: {
        execution?: {
            result?: string;
            message?: string;
            gasConsumed?: number;
        };
    };
    error?: string;
}

export interface RelayedPayload {
    sender: string;
    receiver: string;
    nonce: number;
    value: string; // Atomic units
    data: string; // Base64
    signature: string; // Hex
    gasLimit?: number;
    chainId?: string;
    version?: number;
    options?: number;
    relayer?: string;
}

export class RelayerService {

    /**
     * Determines the correct Relayer Address for a given client address
     * based on shard affinity (Source Shard = Relayer Shard).
     */
    static getRelayerAddress(clientAddress: string): string {
        const address = new Address(clientAddress);
        const computer = new AddressComputer();
        const shard = computer.getShardOfAddress(address);

        let secretKeyStr = "";
        switch (shard) {
            case 0: secretKeyStr = env.RELAYER_SECRET_KEY_SHARD_0; break;
            case 1: secretKeyStr = env.RELAYER_SECRET_KEY_SHARD_1; break;
            case 2: secretKeyStr = env.RELAYER_SECRET_KEY_SHARD_2; break;
            default: secretKeyStr = env.RELAYER_SECRET_KEY_SHARD_0; break; // Fallback or Error
        }

        // Derive Address from Key
        const key = UserSecretKey.fromString(secretKeyStr);
        return key.generatePublicKey().toAddress().bech32();
    }

    /**
     * Helper to get the Signer (Secret Key) for the Relayer responsible for this client.
     */
    private static getRelayerSigner(clientAddress: string): UserSigner {
        const address = new Address(clientAddress);
        const computer = new AddressComputer();
        const shard = computer.getShardOfAddress(address);

        let secretKeyStr = "";
        switch (shard) {
            case 0: secretKeyStr = env.RELAYER_SECRET_KEY_SHARD_0; break;
            case 1: secretKeyStr = env.RELAYER_SECRET_KEY_SHARD_1; break;
            case 2: secretKeyStr = env.RELAYER_SECRET_KEY_SHARD_2; break;
            default: secretKeyStr = env.RELAYER_SECRET_KEY_SHARD_0; break;
        }

        const key = UserSecretKey.fromString(secretKeyStr);
        return new UserSigner(key);
    }

    /**
     * Verifies that the payload was clearly signed by the Sender,
     * intended to be relayed by US (the Adapter).
     */
    static verifySignature(payload: RelayedPayload): boolean {
        try {
            // Determine which Relayer Address the User SHOULD have used
            const relayerAddrStr = this.getRelayerAddress(payload.sender);

            const tx = new Transaction({
                nonce: BigInt(payload.nonce),
                value: BigInt(payload.value),
                receiver: new Address(payload.receiver),
                sender: new Address(payload.sender),
                gasLimit: BigInt(payload.gasLimit || env.GAS_LIMIT),
                chainID: payload.chainId || env.CHAIN_ID,
                data: payload.data ? Buffer.from(payload.data, 'base64') : undefined,
                relayer: new Address(payload.relayer || relayerAddrStr),
                version: payload.version,
                options: payload.options
            });

            // CHECK: If user provided a relayer, it MUST match our shard-aware address
            if (payload.relayer && payload.relayer !== relayerAddrStr) {
                logger.error({ provided: payload.relayer, expected: relayerAddrStr }, "Relayer address mismatch for shard");
                return false;
            }

            // SDK v15 Serialization
            const computer = new TransactionComputer();
            const serialized = computer.computeBytesForSigning(tx);
            const signatureBuffer = Buffer.from(payload.signature, 'hex');

            const address = new Address(payload.sender);
            const pubKey = new UserPublicKey(address.getPublicKey());
            const verifier = new UserVerifier(pubKey);

            return verifier.verify(serialized, signatureBuffer);
        } catch (error) {
            logger.error({ error }, "Verification failed");
            return false;
        }
    }

    /**
     * Packs the validated payload into a RelayedTransactionV3 
     * and signs it with the Adapter's private key.
     */
    static async packRelayedTransaction(payload: RelayedPayload): Promise<Transaction> {
        // 1. Identify correct Relayer for this Sender's Shard
        const relayerAddrStr = this.getRelayerAddress(payload.sender);


        // 2. Reconstruct Transaction exactly as the User signed it
        const tx = new Transaction({
            nonce: BigInt(payload.nonce),
            value: BigInt(payload.value),
            receiver: new Address(payload.receiver),
            sender: new Address(payload.sender),
            gasLimit: BigInt(payload.gasLimit || env.GAS_LIMIT),
            chainID: payload.chainId || env.CHAIN_ID,
            data: payload.data ? Buffer.from(payload.data, 'base64') : undefined,
            relayer: new Address(payload.relayer || relayerAddrStr),
            version: payload.version,
            options: payload.options
        });

        // 3. Apply Sender's Signature
        tx.signature = Buffer.from(payload.signature, 'hex');

        // 4. Sign as Relayer (ONLY set relayerSignature)
        const signer = this.getRelayerSigner(payload.sender);

        // Compute bytes for Relayer Signing
        // For RelayedV3, we sign the transaction object itself
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
        logger.info({ sender: payload.sender, receiver: payload.receiver }, "[Relayer] Broadcasting tx");

        try {
            const tx = await this.packRelayedTransaction(payload);
            const entrypoint = createEntrypoint();
            const broadcastProvider = entrypoint as unknown as {
                simulateTransaction(tx: Transaction): Promise<ISimulationResult>;
                sendTransaction(tx: Transaction): Promise<string>;
            };

            // 5. Simulation BEFORE broadcast (Crucial for Relayed V3)
            logger.info("[Relayer] Simulating transaction...");
            const simulationResult: ISimulationResult = await broadcastProvider.simulateTransaction(tx);

            const { success, errorMessage } = parseSimulationResult(simulationResult as unknown as Record<string, any>);

            if (!success) {
                logger.error({
                    error: errorMessage,
                    simulationResult: JSON.stringify(simulationResult, (_, v) => typeof v === 'bigint' ? v.toString() : v),
                    tx: JSON.stringify(tx.toPlainObject(), (_, v) => typeof v === 'bigint' ? v.toString() : v)
                }, "[Relayer] Simulation failed before broadcast");
                throw new Error(`Simulation failed: ${errorMessage}`);
            }

            logger.info({
                result: 'success',
                simulationRaw: JSON.stringify(simulationResult, (_, v) => typeof v === 'bigint' ? v.toString() : v)
            }, "[Relayer] Simulation successful");

            // Real Broadcast
            const hash = await broadcastProvider.sendTransaction(tx);
            logger.info({ hash }, "[Relayer] Transaction sent");
            return hash;
        } catch (e) {
            logger.error({ error: e }, "Broadcast failed");
            throw e;
        }
    }
}
