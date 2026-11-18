"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthValidation = exports.signUpBodyZodSchema = void 0;
const zod_1 = require("zod");
const user_1 = require("../../../enums/user");
const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const booleanLike = zod_1.z.union([
    zod_1.z.boolean(),
    zod_1.z.enum(["true", "false"]).transform((v) => v === "true"),
]);
const tradeLicenseZodSchema = zod_1.z
    .object({
    licenseNumber: zod_1.z.string().trim().optional(),
    state: zod_1.z.string().trim().optional(),
    certificateUrl: zod_1.z.string().trim().optional(),
})
    .optional();
const liabilityInsuranceZodSchema = zod_1.z
    .object({
    carrier: zod_1.z.string().trim().optional(),
    coverage: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional(),
    certificateUrl: zod_1.z.string().trim().optional(),
})
    .optional();
exports.signUpBodyZodSchema = zod_1.z
    .object({
    name: zod_1.z
        .string({ required_error: "Full name is required" })
        .trim()
        .min(1, "Full name is required"),
    email: zod_1.z
        .string({ required_error: "Email is required" })
        .trim()
        .toLowerCase()
        .email("Invalid email format"),
    phone: zod_1.z
        .string({ required_error: "Phone number is required" })
        .trim()
        .min(5, "Valid phone number is required"),
    password: zod_1.z
        .string({ required_error: "Password is required" })
        .min(6, "Password must be at least 6 characters"),
    confirmPassword: zod_1.z.string().optional(),
    role: zod_1.z
        .enum([user_1.USER_ROLES.HOME_OWNER, user_1.USER_ROLES.PROFESSIONAL])
        .optional()
        .default(user_1.USER_ROLES.HOME_OWNER),
    zipCode: zod_1.z
        .string({ required_error: "ZIP code is required" })
        .trim()
        .min(3, "ZIP code is required"),
    countryCode: zod_1.z.string().trim().optional(),
    agreedToTerms: booleanLike.optional(),
    profileImage: zod_1.z.string().optional(),
    // Professional Step 2: Trade & Area
    companyName: zod_1.z.string().trim().optional(),
    businessName: zod_1.z.string().trim().optional(),
    category: zod_1.z.string().regex(objectIdRegex, "Invalid category ID").optional(),
    serviceRadiusInMiles: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]).optional(),
    // Professional Step 3: Trade License & Liability Insurance
    licenseNumber: zod_1.z.string().trim().optional(),
    licenseState: zod_1.z.string().trim().optional(),
    state: zod_1.z.string().trim().optional(),
    tradeLicenseCertificate: zod_1.z.string().trim().optional(),
    tradeLicense: zod_1.z.union([tradeLicenseZodSchema, zod_1.z.string()]).optional(),
    insuranceCarrier: zod_1.z.string().trim().optional(),
    carrier: zod_1.z.string().trim().optional(),
    insuranceCoverage: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional(),
    coverage: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional(),
    coiCertificate: zod_1.z.string().trim().optional(),
    insuranceCertificate: zod_1.z.string().trim().optional(),
    liabilityInsurance: liabilityInsuranceZodSchema,
    // Professional Step 4: Background Check
    backgroundCheckConsent: booleanLike.optional(),
    checkrCandidateId: zod_1.z.string().trim().optional(),
    checkrInvitationId: zod_1.z.string().trim().optional(),
    checkrInvitationUrl: zod_1.z.string().trim().optional(),
    // Push notifications / device metadata
    fcmToken: zod_1.z.string().optional(),
    deviceId: zod_1.z.string().optional(),
    deviceType: zod_1.z.enum(["ios", "android", "web"]).optional(),
})
    .superRefine((data, ctx) => {
    var _a;
    if (data.confirmPassword !== undefined &&
        data.confirmPassword !== data.password) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ["confirmPassword"],
            message: "Password and confirm password do not match",
        });
    }
    const role = data.role || user_1.USER_ROLES.HOME_OWNER;
    if (role === user_1.USER_ROLES.HOME_OWNER) {
        if (data.agreedToTerms !== true) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                path: ["agreedToTerms"],
                message: "You must agree to the Terms & Conditions and Privacy Policy",
            });
        }
    }
    if (role === user_1.USER_ROLES.PROFESSIONAL) {
        if (data.password.length < 8) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                path: ["password"],
                message: "Password must be at least 8 characters for professionals",
            });
        }
        const businessName = (data.companyName || data.businessName || "").trim();
        if (!businessName) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                path: ["companyName"],
                message: "Business name is required for professionals",
            });
        }
        if (!data.category) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                path: ["category"],
                message: "Primary trade category ID is required for professionals",
            });
        }
        const radiusRaw = data.serviceRadiusInMiles;
        const radiusMatch = typeof radiusRaw === "number"
            ? radiusRaw
            : typeof radiusRaw === "string"
                ? Number((_a = radiusRaw.match(/\d+(\.\d+)?/)) === null || _a === void 0 ? void 0 : _a[0])
                : NaN;
        if (isNaN(radiusMatch) || radiusMatch <= 0) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                path: ["serviceRadiusInMiles"],
                message: "Valid service radius in miles is required",
            });
        }
        const nestedLicense = data.tradeLicense && typeof data.tradeLicense === "object"
            ? data.tradeLicense
            : {};
        const licenseNumber = (nestedLicense.licenseNumber ||
            data.licenseNumber ||
            "").trim();
        const licenseState = (nestedLicense.state ||
            data.licenseState ||
            data.state ||
            "").trim();
        if (!licenseNumber) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                path: ["licenseNumber"],
                message: "Trade license number is required for professionals",
            });
        }
        if (!licenseState) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                path: ["licenseState"],
                message: "Trade license state is required for professionals",
            });
        }
        if (data.backgroundCheckConsent !== true) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                path: ["backgroundCheckConsent"],
                message: "You must agree to complete the background check on Checkr",
            });
        }
    }
});
const signUpZodSchema = zod_1.z.object({
    body: exports.signUpBodyZodSchema,
});
const createVerifyEmailZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z
            .string({ required_error: "Email is required" })
            .trim()
            .toLowerCase()
            .email("Invalid email format"),
        oneTimeCode: zod_1.z.number({ required_error: "One time code is required" }),
    }),
});
const createLoginZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string({ required_error: "Email is required" }),
        password: zod_1.z.string({ required_error: "Password is required" }),
        fcmToken: zod_1.z.string().optional(),
        deviceId: zod_1.z.string().optional(),
        deviceType: zod_1.z.enum(["ios", "android", "web"]).optional(),
    }),
});
const createForgetPasswordZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z
            .string({ required_error: "Email is required" })
            .email("Invalid email format"),
    }),
});
const createResetPasswordZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        newPassword: zod_1.z
            .string({ required_error: "Password is required" })
            .min(6, "Password must be at least 6 characters"),
        confirmPassword: zod_1.z.string({
            required_error: "Confirm Password is required",
        }),
    }),
});
const createChangePasswordZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        currentPassword: zod_1.z.string({
            required_error: "Current Password is required",
        }),
        newPassword: zod_1.z
            .string({ required_error: "New Password is required" })
            .min(6, "Password must be at least 6 characters"),
        confirmPassword: zod_1.z.string({
            required_error: "Confirm Password is required",
        }),
    }),
});
exports.AuthValidation = {
    signUpZodSchema,
    createVerifyEmailZodSchema,
    createForgetPasswordZodSchema,
    createLoginZodSchema,
    createResetPasswordZodSchema,
    createChangePasswordZodSchema,
};
