import { z } from "zod";

const createCheckoutSessionZodSchema = z.object({
  body: z.object({
    packageId: z.string({ required_error: "Package ID is required" }),
    planType: z.enum(["monthly", "yearly"], {
      required_error: "Plan type must be either 'monthly' or 'yearly'",
    }),
  }),
});

const updateSubscriptionPlanZodSchema = z.object({
  body: z.object({
    packageId: z.string({ required_error: "Target package ID is required" }),
    planType: z.enum(["monthly", "yearly"], {
      required_error: "Plan type must be either 'monthly' or 'yearly'",
    }),
  }),
});

export const SubscriptionValidation = {
  createCheckoutSessionZodSchema,
  updateSubscriptionPlanZodSchema,
};
