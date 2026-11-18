"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PackageValidation = void 0;
const zod_1 = require("zod");
const createPackageZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string({ required_error: "Package name is required" }).min(1),
        description: zod_1.z.string().optional(),
        price: zod_1.z
            .number({ required_error: "Package price is required" })
            .min(0, "Price must be greater than or equal to 0"),
        billingCycle: zod_1.z.enum(["monthly", "yearly"]).default("monthly"),
        features: zod_1.z.array(zod_1.z.string()).default([]),
        leadLimit: zod_1.z
            .number({ required_error: "Lead limit is required" })
            .default(-1), // -1 for unlimited
        hasTrial: zod_1.z.boolean().default(false),
        trialDays: zod_1.z
            .number()
            .min(0, "Trial days cannot be negative")
            .default(0),
        isPopular: zod_1.z.boolean().optional().default(false),
        isActive: zod_1.z.boolean().optional().default(true),
        stripeProductId: zod_1.z.string().optional(),
        stripePriceId: zod_1.z.string().optional(),
    }),
});
const updatePackageZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1).optional(),
        description: zod_1.z.string().optional(),
        price: zod_1.z.number().min(0).optional(),
        billingCycle: zod_1.z.enum(["monthly", "yearly"]).optional(),
        features: zod_1.z.array(zod_1.z.string()).optional(),
        leadLimit: zod_1.z.number().optional(),
        hasTrial: zod_1.z.boolean().optional(),
        trialDays: zod_1.z.number().min(0, "Trial days cannot be negative").optional(),
        isPopular: zod_1.z.boolean().optional(),
        isActive: zod_1.z.boolean().optional(),
        stripeProductId: zod_1.z.string().optional(),
        stripePriceId: zod_1.z.string().optional(),
    }),
});
exports.PackageValidation = {
    createPackageZodSchema,
    updatePackageZodSchema,
};
