"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarqueeValidation = void 0;
const zod_1 = require("zod");
const createMarqueeZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        keyword: zod_1.z
            .string({ required_error: "Service keyword is required" })
            .trim()
            .min(1, "Service keyword cannot be empty"),
        isEnabled: zod_1.z.boolean().optional(),
        order: zod_1.z.number().int().min(0).optional(),
    }),
});
const updateMarqueeZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        keyword: zod_1.z
            .string()
            .trim()
            .min(1, "Service keyword cannot be empty")
            .optional(),
        isEnabled: zod_1.z.boolean().optional(),
        order: zod_1.z.number().int().min(0).optional(),
    }),
});
const toggleMarqueeStatusZodSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        isEnabled: zod_1.z.boolean().optional(),
    })
        .optional()
        .default({}),
});
exports.MarqueeValidation = {
    createMarqueeZodSchema,
    updateMarqueeZodSchema,
    toggleMarqueeStatusZodSchema,
};
