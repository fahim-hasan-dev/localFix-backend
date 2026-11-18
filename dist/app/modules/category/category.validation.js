"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoryValidation = void 0;
const zod_1 = require("zod");
const booleanSchema = zod_1.z.preprocess((val) => {
    if (typeof val === "string") {
        if (val.toLowerCase() === "true")
            return true;
        if (val.toLowerCase() === "false")
            return false;
    }
    return val;
}, zod_1.z.boolean());
const createCategoryZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z
            .string({ required_error: "Category name is required" })
            .trim()
            .min(1, "Category name is required"),
        coverImage: zod_1.z.string().optional(),
        icon: zod_1.z.string().optional(),
        isActive: booleanSchema.optional().default(true),
    }),
});
const updateCategoryZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().trim().min(1, "Category name cannot be empty").optional(),
        coverImage: zod_1.z.string().optional(),
        icon: zod_1.z.string().optional(),
        isActive: booleanSchema.optional(),
    }),
});
exports.CategoryValidation = {
    createCategoryZodSchema,
    updateCategoryZodSchema,
};
