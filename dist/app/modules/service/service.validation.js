"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceValidation = void 0;
const zod_1 = require("zod");
const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const createServiceZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z
            .string({ required_error: "Service name is required" })
            .trim()
            .min(1, "Service name is required"),
        category: zod_1.z
            .string({ required_error: "Category is required" })
            .trim()
            .regex(objectIdRegex, "Invalid category ID"),
        description: zod_1.z
            .string({ required_error: "Service description is required" })
            .trim()
            .min(1, "Service description is required"),
    }),
});
const updateServiceZodSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        name: zod_1.z.string().trim().min(1, "Service name cannot be empty").optional(),
        category: zod_1.z
            .string()
            .trim()
            .regex(objectIdRegex, "Invalid category ID")
            .optional(),
        description: zod_1.z
            .string()
            .trim()
            .min(1, "Service description cannot be empty")
            .optional(),
    })
        .refine((data) => data.name !== undefined ||
        data.category !== undefined ||
        data.description !== undefined, {
        message: "At least one field must be provided to update",
    }),
});
exports.ServiceValidation = {
    createServiceZodSchema,
    updateServiceZodSchema,
};
