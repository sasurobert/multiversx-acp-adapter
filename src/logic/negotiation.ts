import { UserSigner, UserSecretKey } from "@multiversx/sdk-wallet";
import * as crypto from "crypto";
import { Address } from "@multiversx/sdk-core";

export interface RFP {
    rfp_id: string;
    client_id: string;
    task_description: string;
    budget_limit: string;
    token_identifier: string;
    deadline_block: number;
    min_reputation?: number;
}

export interface Proposal {
    job_id: string;
    price: string;
    token: string;
    deadline_block: number;
    vendor_signature: string;
}

export class NegotiationService {
    /**
     * Creates a signed Proposal in response to an RFP.
     * 1. Validates VENDOR_SECRET_KEY env var.
     * 2. Generates a unique Job ID.
     * 3. Signs the Agreement (PoA) hash.
     */
    static async createProposal(rfp: RFP): Promise<Proposal> {
        if (!process.env.VENDOR_SECRET_KEY) {
            throw new Error("Missing VENDOR_SECRET_KEY");
        }

        const jobId = crypto.randomUUID();
        // MVP Logic: Accept budget 1:1
        const price = rfp.budget_limit;
        const token = rfp.token_identifier;
        const deadline = rfp.deadline_block;

        // Construct PoA Data to sign
        // Format: sha256(job_id + client + vendor + token + amount + deadline)
        // We need the Vendor Address to include in the hash match.
        const secretKey = UserSecretKey.fromString(process.env.VENDOR_SECRET_KEY);
        const signer = new UserSigner(secretKey);
        const vendorAddress = secretKey.generatePublicKey().toAddress().bech32();

        const dataToSign = `${jobId}${rfp.client_id}${vendorAddress}${token}${price}${deadline}`;
        const messageHash = crypto.createHash('sha256').update(dataToSign).digest();

        // Sign the hash
        const signature = await signer.sign(messageHash);
        const signatureHex = signature.toString("hex");

        return {
            job_id: jobId,
            price: price,
            token: token,
            deadline_block: deadline,
            vendor_signature: signatureHex
        };
    }
}
