"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BannerZodValidation = void 0;
const zod_1 = require("zod");
const upsertBannerValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        headline: zod_1.z.string().trim().min(1, "Headline cannot be empty").optional(),
        description: zod_1.z
            .string()
            .trim()
            .min(1, "Description cannot be empty")
            .optional(),
        image: zod_1.z.string().min(1, "Image cannot be empty").optional(),
    }),
});
exports.BannerZodValidation = {
    upsertBannerValidationSchema,
};
