"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupportTicketValidation = void 0;
const zod_1 = require("zod");
const user_1 = require("../../../enums/user");
const supportTicket_constant_1 = require("./supportTicket.constant");
const createSupportTicketZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        subject: zod_1.z
            .string({ required_error: "Subject is required" })
            .min(1, "Subject cannot be empty"),
        description: zod_1.z
            .string({ required_error: "Detailed description is required" })
            .min(1, "Detailed description cannot be empty"),
        priority: zod_1.z
            .nativeEnum(supportTicket_constant_1.SUPPORT_TICKET_PRIORITY, {
            errorMap: () => ({
                message: "Priority must be urgent, high, medium, or low",
            }),
        })
            .optional(),
        relatedJobId: zod_1.z.string().optional(),
        requesterName: zod_1.z.string().optional(),
        requesterEmail: zod_1.z.string().email("Invalid email address").optional(),
        requesterRole: zod_1.z
            .nativeEnum(user_1.USER_ROLES, {
            errorMap: () => ({ message: "Invalid requester role" }),
        })
            .optional(),
    }),
});
const updateSupportTicketZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        status: zod_1.z.nativeEnum(supportTicket_constant_1.SUPPORT_TICKET_STATUS).optional(),
        priority: zod_1.z.nativeEnum(supportTicket_constant_1.SUPPORT_TICKET_PRIORITY).optional(),
        assignedAdmin: zod_1.z.string().optional().nullable(),
    }),
});
const addReplyZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        message: zod_1.z
            .string({ required_error: "Reply message is required" })
            .min(1, "Reply message cannot be empty"),
    }),
});
exports.SupportTicketValidation = {
    createSupportTicketZodSchema,
    updateSupportTicketZodSchema,
    addReplyZodSchema,
};
