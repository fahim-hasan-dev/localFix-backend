"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SiteSettingsZodValidation = void 0;
const zod_1 = require("zod");
const upsertSiteSettingsValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        platformBrandName: zod_1.z
            .string()
            .trim()
            .min(1, "Platform brand name cannot be empty")
            .optional(),
        headerLogo: zod_1.z.string().min(1, "Header logo cannot be empty").optional(),
        footerLogo: zod_1.z.string().min(1, "Footer logo cannot be empty").optional(),
        favicon: zod_1.z.string().min(1, "Favicon cannot be empty").optional(),
        supportEmail: zod_1.z
            .string()
            .trim()
            .email("Invalid support email address")
            .optional(),
        supportPhone: zod_1.z
            .string()
            .trim()
            .min(1, "Support phone cannot be empty")
            .optional(),
        address: zod_1.z.string().trim().min(1, "Address cannot be empty").optional(),
        facebookUrl: zod_1.z
            .string()
            .trim()
            .url("Invalid Facebook URL")
            .optional()
            .or(zod_1.z.literal("")),
        instagramUrl: zod_1.z
            .string()
            .trim()
            .url("Invalid Instagram URL")
            .optional()
            .or(zod_1.z.literal("")),
        linkedinUrl: zod_1.z
            .string()
            .trim()
            .url("Invalid LinkedIn URL")
            .optional()
            .or(zod_1.z.literal("")),
    }),
});
exports.SiteSettingsZodValidation = {
    upsertSiteSettingsValidationSchema,
};
