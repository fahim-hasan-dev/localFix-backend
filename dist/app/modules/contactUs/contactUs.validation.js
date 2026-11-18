"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContactUsValidation = void 0;
const zod_1 = require("zod");
const contactUs_constant_1 = require("./contactUs.constant");
const createContactUsZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z
            .string({ required_error: "Full name is required" })
            .min(1, "Full name cannot be empty"),
        email: zod_1.z
            .string({ required_error: "Email address is required" })
            .email("Invalid email address"),
        subject: zod_1.z
            .string({ required_error: "Subject is required" })
            .min(1, "Subject cannot be empty"),
        message: zod_1.z
            .string({ required_error: "Message is required" })
            .min(1, "Message cannot be empty"),
        priority: zod_1.z.nativeEnum(contactUs_constant_1.CONTACT_US_PRIORITY).optional(),
    }),
});
const updateContactUsStatusZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        status: zod_1.z.nativeEnum(contactUs_constant_1.CONTACT_US_STATUS).optional(),
        priority: zod_1.z.nativeEnum(contactUs_constant_1.CONTACT_US_PRIORITY).optional(),
    }),
});
exports.ContactUsValidation = {
    createContactUsZodSchema,
    updateContactUsStatusZodSchema,
};
