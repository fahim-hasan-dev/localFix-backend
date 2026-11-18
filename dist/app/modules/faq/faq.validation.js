"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FaqValidation = void 0;
const zod_1 = require("zod");
const faq_constant_1 = require("./faq.constant");
const roleSchema = zod_1.z.preprocess((val) => {
    if (typeof val === "string") {
        return (0, faq_constant_1.normalizeFaqRole)(val);
    }
    return val;
}, zod_1.z.enum(faq_constant_1.FAQ_ROLES, {
    errorMap: () => ({
        message: `Invalid role. Role must be one of: ${faq_constant_1.FAQ_ROLES.join(", ")}`,
    }),
}));
const createFaqZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        question: zod_1.z
            .string({ required_error: "Question is required" })
            .min(1, "Question cannot be empty"),
        answer: zod_1.z
            .string({ required_error: "Answer is required" })
            .min(1, "Answer cannot be empty"),
        role: roleSchema.optional(),
        type: roleSchema.optional(),
        category: roleSchema.optional(),
        order: zod_1.z.number().int().min(0).optional(),
    }),
});
const updateFaqZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        question: zod_1.z.string().min(1, "Question cannot be empty").optional(),
        answer: zod_1.z.string().min(1, "Answer cannot be empty").optional(),
        role: roleSchema.optional(),
        type: roleSchema.optional(),
        category: roleSchema.optional(),
        order: zod_1.z.number().int().min(0).optional(),
    }),
});
exports.FaqValidation = {
    createFaqZodSchema,
    updateFaqZodSchema,
};
