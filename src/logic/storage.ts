import fs from "fs";
import path from "path";
import { logger } from "../utils/logger";
import { RFP, Proposal } from "./negotiation";
import { RelayedPayload } from "./relayer";
import { CheckoutSession } from "../types/acp";

export interface JobData<T = RFP, P = Proposal> {
    id: string;
    status: string;
    rfp: T;
    proposal: P;
}

export interface PaymentData<T = RelayedPayload> {
    token: string;
    status: string;
    payload: T;
}

export interface SessionData<T = CheckoutSession> {
    id: string;
    status: string;
    data: T;
}

export class StorageService {
    private static storageDir = path.join(process.cwd(), "data");
    private static jobsFile = path.join(StorageService.storageDir, "jobs.json");
    private static paymentsFile = path.join(StorageService.storageDir, "payments.json");
    private static sessionsFile = path.join(StorageService.storageDir, "sessions.json");

    static jobs: Record<string, JobData> = {};
    static payments: Record<string, PaymentData> = {};
    static sessions: Record<string, SessionData> = {};

    /**
     * Initializes storage by ensuring data directory and loading existing JSON files.
     */
    static init() {
        if (!fs.existsSync(this.storageDir)) {
            fs.mkdirSync(this.storageDir);
        }

        if (fs.existsSync(this.jobsFile)) {
            try {
                this.jobs = JSON.parse(fs.readFileSync(this.jobsFile, "utf-8"));
            } catch (e) {
                logger.error({ error: e }, "Failed to load jobs storage");
                this.jobs = {};
            }
        }

        if (fs.existsSync(this.paymentsFile)) {
            try {
                this.payments = JSON.parse(fs.readFileSync(this.paymentsFile, "utf-8"));
            } catch (e) {
                logger.error({ error: e }, "Failed to load payments storage");
                this.payments = {};
            }
        }

        if (fs.existsSync(this.sessionsFile)) {
            try {
                this.sessions = JSON.parse(fs.readFileSync(this.sessionsFile, "utf-8"));
            } catch (e) {
                logger.error({ error: e }, "Failed to load sessions storage");
                this.sessions = {};
            }
        }
    }

    /**
     * Saves current state to disk.
     */
    static save() {
        try {
            fs.writeFileSync(this.jobsFile, JSON.stringify(this.jobs, null, 2));
            fs.writeFileSync(this.paymentsFile, JSON.stringify(this.payments, null, 2));
            fs.writeFileSync(this.sessionsFile, JSON.stringify(this.sessions, null, 2));
        } catch (e) {
            logger.error({ error: e }, "Failed to save storage");
        }
    }

    /**
     * Adds or updates a job and persists.
     */
    static setJob(jobId: string, data: JobData) {
        this.jobs[jobId] = data;
        this.save();
    }

    /**
     * Adds or updates a payment and persists.
     */
    static setPayment(paymentToken: string, data: PaymentData) {
        this.payments[paymentToken] = data;
        this.save();
    }

    /**
     * Adds or updates a checkout session and persists.
     */
    static setSession(sessionId: string, data: SessionData) {
        this.sessions[sessionId] = data;
        this.save();
    }

    /**
     * Gets a checkout session by ID.
     */
    static getSession<T = CheckoutSession>(sessionId: string): SessionData<T> | undefined {
        return this.sessions[sessionId] as SessionData<T> | undefined;
    }
}
