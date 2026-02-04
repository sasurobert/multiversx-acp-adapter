import { Message } from "../types/acp";

export class MessageService {
    /**
     * Create an error message for an invalid field
     */
    static createFieldErrorMessage(field: string, message: string): Message {
        return {
            type: "error",
            code: "invalid",
            param: `$.${field}`,
            content_type: "plain",
            content: message,
        };
    }

    /**
     * Create an info message (e.g., about shipping delays)
     */
    static createInfoMessage(code: string, message: string): Message {
        return {
            type: "info",
            code,
            content_type: "plain",
            content: message,
        };
    }

    /**
     * Create a generic error message
     */
    static createGenericError(message: string): Message {
        return {
            type: "error",
            code: "invalid_request",
            content_type: "plain",
            content: message,
        };
    }
}
