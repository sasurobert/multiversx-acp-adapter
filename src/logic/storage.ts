import fs from "fs";
import path from "path";
import { logger } from "../utils/logger";

export interface JobData {
    id: string;
    status: string;
    [key: string]: unknown;
}

export interface PaymentData {
    token: string;
    status: string;
    [key: string]: unknown;
}

export interface SessionData {
    id: string;
    status: string;
    [key: string]: unknown;
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
    static setSession<T extends { id: string; status: string }>(sessionId: string, data: T) {
        this.sessions[sessionId] = data as unknown as SessionData;
        this.save();
    }

    /**
     * Gets a checkout session by ID.
     */
    static getSession<T = SessionData>(sessionId: string): T | undefined {
        return this.sessions[sessionId] as unknown as T;
    }
}
