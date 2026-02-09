import { Address, Abi, Token, TokenTransfer } from "@multiversx/sdk-core";
import fs from "fs";
import path from "path";
import { createEntrypoint } from "../utils/environment";

const ESCROW_GAS_LIMIT = 60_000_000n;

export interface DepositParams {
    job_id: string;
    token: string;
    token_nonce: number;
    amount: string;
    agent_nonce: number;
    service_id: string;
    validator_address: string;
}

const abiPath = path.join(__dirname, "../abis/validation-registry.abi.json");
const validationAbi = Abi.create(JSON.parse(fs.readFileSync(abiPath, "utf-8")));

export class EscrowService {
    /**
     * Builds the Data field for the Transaction using the ABI factory.
     */
    static async buildDepositPayload(params: DepositParams): Promise<string> {
        const tx = await this.buildDepositTransaction(params, Address.Zero().toBech32());
        return tx.data ? Buffer.from(tx.data).toString("base64") : "";
    }

    /**
     * Builds a Deposit (init_job_with_payment) transaction using the ABI factory.
     */
    static async buildDepositTransaction(params: DepositParams, sender: string) {
        const entrypoint = createEntrypoint();
        const factory = entrypoint.createSmartContractTransactionsFactory(validationAbi);

        const senderAddress = Address.newFromBech32(sender);
        const contractAddress = Address.newFromBech32(params.validator_address);

        if (params.token === "EGLD") {
            return await factory.createTransactionForExecute(senderAddress, {
                contract: contractAddress,
                function: "init_job_with_payment",
                gasLimit: ESCROW_GAS_LIMIT,
                arguments: [
                    Buffer.from(params.job_id),
                    BigInt(params.agent_nonce),
                    Buffer.from(params.service_id)
                ],
                nativeTransferAmount: BigInt(params.amount)
            });
        } else {
            return await factory.createTransactionForExecute(senderAddress, {
                contract: contractAddress,
                function: "init_job_with_payment",
                gasLimit: ESCROW_GAS_LIMIT,
                arguments: [
                    Buffer.from(params.job_id),
                    BigInt(params.agent_nonce),
                    Buffer.from(params.service_id)
                ],
                tokenTransfers: [
                    new TokenTransfer({
                        token: new Token({ identifier: params.token, nonce: BigInt(params.token_nonce) }),
                        amount: BigInt(params.amount)
                    })
                ]
            });
        }
    }
}
