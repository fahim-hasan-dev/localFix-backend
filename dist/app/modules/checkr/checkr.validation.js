"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckrValidation = void 0;
const zod_1 = require("zod");
const booleanLike = zod_1.z.union([
    zod_1.z.boolean(),
    zod_1.z.enum(["true", "false"]).transform((v) => v === "true"),
]);
const initiateBackgroundCheckZodSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        consentAccepted: booleanLike.optional(),
        forceNew: booleanLike.optional(),
    })
        .optional()
        .default({}),
});
const startScreeningZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z
            .string({ required_error: "Full name is required" })
            .trim()
            .min(1, "Full name is required"),
        email: zod_1.z
            .string({ required_error: "Email is required" })
            .trim()
            .toLowerCase()
            .email("Invalid email format"),
        phone: zod_1.z.string().trim().optional(),
        zipCode: zod_1.z.string().trim().optional(),
        state: zod_1.z.string().trim().optional(),
        consentAccepted: booleanLike.refine((val) => val === true, {
            message: "You must agree to complete the background check on Checkr",
        }),
    }),
});
exports.CheckrValidation = {
    initiateBackgroundCheckZodSchema,
    startScreeningZodSchema,
};
