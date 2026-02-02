import { Address } from "@multiversx/sdk-core";

export interface DepositParams {
    job_id: string;
    token: string;
    amount: string;
    poa_hash: string;
    vendor: string;
}

export class EscrowService {
    /**
     * Builds the Data field for the Transaction.
     * Supports EGLD and ESDT transfers.
     */
    static buildDepositPayload(params: DepositParams): string {
        const jobIdHex = Buffer.from(params.job_id).toString("hex");
        const poaHex = params.poa_hash; // Assumed already hex
        const vendorHex = new Address(params.vendor).toHex();

        // Function args: job_id, vendor, poa_hash
        const funcArgs = `${jobIdHex}@${vendorHex}@${poaHex}`;

        if (params.token === "EGLD") {
            // Simple Contract Call
            return `deposit@${funcArgs}`;
        } else {
            // ESDTTransfer
            const tokenHex = Buffer.from(params.token).toString("hex");

            // Amount Handling: Must be even length hex
            let amountHex = BigInt(params.amount).toString(16);
            if (amountHex.length % 2 !== 0) amountHex = "0" + amountHex;

            const funcHex = Buffer.from("deposit").toString("hex");

            return `ESDTTransfer@${tokenHex}@${amountHex}@${funcHex}@${funcArgs}`;
        }
    }
}
