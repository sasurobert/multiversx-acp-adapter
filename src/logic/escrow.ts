import { Address, Abi, Token, TokenTransfer } from "@multiversx/sdk-core";
import fs from "fs";
import path from "path";
import { createEntrypoint, env } from "../utils/environment";

const ESCROW_GAS_LIMIT = 60_000_000n;

export interface DepositParams {
    job_id: string;
    token: string;
    token_nonce: number;
    amount: string;
    receiver: string;       // Agent/worker address (erd1...)
    poa_hash: string;       // Proof-of-Agreement hash
    deadline: number;       // Unix timestamp (seconds)
}

export interface ReleaseParams {
    job_id: string;
}

export interface RefundParams {
    job_id: string;
}

// Load Escrow contract ABI
const escrowAbiPath = path.join(__dirname, "../abis/escrow.abi.json");
const escrowRawAbi = fs.readFileSync(escrowAbiPath, "utf-8");
const escrowAbi = Abi.create(JSON.parse(escrowRawAbi));

export class EscrowService {
    /**
     * Builds the Data field for the Deposit Transaction using the ABI factory.
     */
    static async buildDepositPayload(params: DepositParams): Promise<string> {
        const tx = await this.buildDepositTransaction(params, Address.Zero().toBech32());
        return tx.data ? Buffer.from(tx.data).toString("base64") : "";
    }

    /**
     * Builds a Deposit transaction using the Escrow contract ABI.
     * Escrow.deposit(job_id: bytes, receiver: Address, poa_hash: bytes, deadline: u64)
     * Payable in any token ("*").
     */
    static async buildDepositTransaction(params: DepositParams, sender: string) {
        const entrypoint = createEntrypoint();
        const factory = entrypoint.createSmartContractTransactionsFactory(escrowAbi);

        const senderAddress = Address.newFromBech32(sender);
        const contractAddress = Address.newFromBech32(env.ESCROW_CONTRACT_ADDRESS);

        const args = [
            Buffer.from(params.job_id),
            Address.newFromBech32(params.receiver),
            Buffer.from(params.poa_hash),
            BigInt(params.deadline),
        ];

        if (params.token === "EGLD") {
            return await factory.createTransactionForExecute(senderAddress, {
                contract: contractAddress,
                function: "deposit",
                gasLimit: ESCROW_GAS_LIMIT,
                arguments: args,
                nativeTransferAmount: BigInt(params.amount),
            });
        } else {
            return await factory.createTransactionForExecute(senderAddress, {
                contract: contractAddress,
                function: "deposit",
                gasLimit: ESCROW_GAS_LIMIT,
                arguments: args,
                tokenTransfers: [
                    new TokenTransfer({
                        token: new Token({ identifier: params.token, nonce: BigInt(params.token_nonce) }),
                        amount: BigInt(params.amount),
                    }),
                ],
            });
        }
    }

    /**
     * Builds a Release transaction.
     * Escrow.release(job_id: bytes) — only callable by the employer.
     */
    static async buildReleaseTransaction(params: ReleaseParams, sender: string) {
        const entrypoint = createEntrypoint();
        const factory = entrypoint.createSmartContractTransactionsFactory(escrowAbi);

        const senderAddress = Address.newFromBech32(sender);
        const contractAddress = Address.newFromBech32(env.ESCROW_CONTRACT_ADDRESS);

        return await factory.createTransactionForExecute(senderAddress, {
            contract: contractAddress,
            function: "release",
            gasLimit: ESCROW_GAS_LIMIT,
            arguments: [Buffer.from(params.job_id)],
        });
    }

    /**
     * Builds a Refund transaction.
     * Escrow.refund(job_id: bytes) — anyone can call if deadline passed.
     */
    static async buildRefundTransaction(params: RefundParams, sender: string) {
        const entrypoint = createEntrypoint();
        const factory = entrypoint.createSmartContractTransactionsFactory(escrowAbi);

        const senderAddress = Address.newFromBech32(sender);
        const contractAddress = Address.newFromBech32(env.ESCROW_CONTRACT_ADDRESS);

        return await factory.createTransactionForExecute(senderAddress, {
            contract: contractAddress,
            function: "refund",
            gasLimit: ESCROW_GAS_LIMIT,
            arguments: [Buffer.from(params.job_id)],
        });
    }
}
