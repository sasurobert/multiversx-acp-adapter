import fs from "fs";
import path from "path";

export class StorageService {
    private static storageDir = path.join(process.cwd(), "data");
    private static jobsFile = path.join(StorageService.storageDir, "jobs.json");
    private static paymentsFile = path.join(StorageService.storageDir, "payments.json");
    private static sessionsFile = path.join(StorageService.storageDir, "sessions.json");

    static jobs: Record<string, any> = {};
    static payments: Record<string, any> = {};
    static sessions: Record<string, any> = {};

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
                console.error("Failed to load jobs storage:", e);
                this.jobs = {};
            }
        }

        if (fs.existsSync(this.paymentsFile)) {
            try {
                this.payments = JSON.parse(fs.readFileSync(this.paymentsFile, "utf-8"));
            } catch (e) {
                console.error("Failed to load payments storage:", e);
                this.payments = {};
            }
        }

        if (fs.existsSync(this.sessionsFile)) {
            try {
                this.sessions = JSON.parse(fs.readFileSync(this.sessionsFile, "utf-8"));
            } catch (e) {
                console.error("Failed to load sessions storage:", e);
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
            console.error("Failed to save storage:", e);
        }
    }

    /**
     * Adds or updates a job and persists.
     */
    static setJob(jobId: string, data: any) {
        this.jobs[jobId] = data;
        this.save();
    }

    /**
     * Adds or updates a payment and persists.
     */
    static setPayment(paymentToken: string, data: any) {
        this.payments[paymentToken] = data;
        this.save();
    }

    /**
     * Adds or updates a checkout session and persists.
     */
    static setSession(sessionId: string, data: any) {
        this.sessions[sessionId] = data;
        this.save();
    }

    /**
     * Gets a checkout session by ID.
     */
    static getSession(sessionId: string): any | undefined {
        return this.sessions[sessionId];
    }
}
