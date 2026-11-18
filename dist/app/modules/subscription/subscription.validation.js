"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionValidation = void 0;
const zod_1 = require("zod");
const createCheckoutSessionZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        packageId: zod_1.z.string({ required_error: "Package ID is required" }),
        planType: zod_1.z.enum(["monthly", "yearly"], {
            required_error: "Plan type must be either 'monthly' or 'yearly'",
        }),
    }),
});
const updateSubscriptionPlanZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        packageId: zod_1.z.string({ required_error: "Target package ID is required" }),
        planType: zod_1.z.enum(["monthly", "yearly"], {
            required_error: "Plan type must be either 'monthly' or 'yearly'",
        }),
    }),
});
exports.SubscriptionValidation = {
    createCheckoutSessionZodSchema,
    updateSubscriptionPlanZodSchema,
};
