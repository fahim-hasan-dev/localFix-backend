"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserValidation = void 0;
const zod_1 = require("zod");
const user_1 = require("../../../enums/user");
const auth_validation_1 = require("../auth/auth.validation");
const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const locationZodSchema = zod_1.z
    .object({
    type: zod_1.z.literal("Point").optional().default("Point"),
    coordinates: zod_1.z
        .tuple([
        zod_1.z.coerce
            .number()
            .min(-180, "Longitude must be between -180 and 180")
            .max(180, "Longitude must be between -180 and 180"),
        zod_1.z.coerce
            .number()
            .min(-90, "Latitude must be between -90 and 90")
            .max(90, "Latitude must be between -90 and 90"),
    ])
        .optional(),
    address: zod_1.z.string().trim().optional(),
})
    .optional();
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
    expires: zod_1.z.string().trim().optional(),
    expiresAt: zod_1.z.string().trim().optional(),
    certificateUrl: zod_1.z.string().trim().optional(),
})
    .optional();
const businessDayHoursZodSchema = zod_1.z
    .object({
    isOpen: zod_1.z.union([zod_1.z.boolean(), zod_1.z.string()]).optional(),
    openTime: zod_1.z.string().trim().optional(),
    closeTime: zod_1.z.string().trim().optional(),
})
    .optional();
const businessHoursZodSchema = zod_1.z
    .object({
    mode: zod_1.z.enum(["all_days", "customize"]).optional(),
    allDays: businessDayHoursZodSchema,
    days: zod_1.z
        .object({
        monday: businessDayHoursZodSchema,
        tuesday: businessDayHoursZodSchema,
        wednesday: businessDayHoursZodSchema,
        thursday: businessDayHoursZodSchema,
        friday: businessDayHoursZodSchema,
        saturday: businessDayHoursZodSchema,
        sunday: businessDayHoursZodSchema,
    })
        .optional(),
    emergencyDispatchAvailable: zod_1.z.union([zod_1.z.boolean(), zod_1.z.string()]).optional(),
})
    .optional();
const projectPhotoItemZodSchema = zod_1.z.object({
    image: zod_1.z.string().trim().min(1, "Project photo image is required"),
    title: zod_1.z.string().trim().min(1, "Project photo title is required"),
    category: zod_1.z.string().regex(objectIdRegex, "Invalid category ID"),
});
const optionalUserFields = {
    profileImage: zod_1.z.string().optional(),
    dateOfBirth: zod_1.z
        .union([
        zod_1.z.string().refine((val) => !val || !isNaN(Date.parse(val)), {
            message: "Invalid date of birth format",
        }),
        zod_1.z.date(),
    ])
        .optional(),
    gender: zod_1.z.nativeEnum(user_1.GENDER).optional(),
    about: zod_1.z.string().trim().optional(),
    serviceRadiusInMiles: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]).optional(),
    yearsOfExperience: zod_1.z.string().trim().optional(),
    category: zod_1.z
        .string()
        .regex(objectIdRegex, "Invalid category ID")
        .nullable()
        .optional(),
    phone: zod_1.z.string().trim().optional(),
    countryCode: zod_1.z.string().trim().optional(),
    deviceToken: zod_1.z.string().optional(),
    state: zod_1.z.string().trim().optional(),
    city: zod_1.z.string().trim().optional(),
    zipCode: zod_1.z.string().trim().optional(),
    streetAddress: zod_1.z.string().trim().optional(),
    address: zod_1.z.string().trim().optional(),
    companyName: zod_1.z.string().trim().optional(),
    businessName: zod_1.z.string().trim().optional(),
    licenseNumber: zod_1.z.string().trim().optional(),
    licenseState: zod_1.z.string().trim().optional(),
    tradeLicenseCertificate: zod_1.z.string().trim().optional(),
    tradeLicense: zod_1.z.union([tradeLicenseZodSchema, zod_1.z.string()]).optional(),
    insuranceCarrier: zod_1.z.string().trim().optional(),
    insuranceCoverage: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional(),
    insuranceExpires: zod_1.z.string().trim().optional(),
    coiCertificate: zod_1.z.string().trim().optional(),
    insuranceCertificate: zod_1.z.string().trim().optional(),
    liabilityInsurance: liabilityInsuranceZodSchema,
    businessHours: businessHoursZodSchema,
    emergencyDispatchAvailable: zod_1.z.union([zod_1.z.boolean(), zod_1.z.string()]).optional(),
    acceptedPayments: zod_1.z.array(zod_1.z.string().trim().min(1)).optional(),
    projectPhotos: zod_1.z.array(projectPhotoItemZodSchema).optional(),
    startingRate: zod_1.z.coerce.number().min(0).optional(),
    hourlyRate: zod_1.z.coerce.number().min(0).optional(),
    completedJobs: zod_1.z.coerce.number().min(0).optional(),
    localJobs: zod_1.z.coerce.number().min(0).optional(),
    responseTime: zod_1.z.string().trim().optional(),
    availability: zod_1.z.string().trim().optional(),
    location: locationZodSchema,
    timezone: zod_1.z.string().trim().optional(),
};
const createAdminZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z
            .string({ required_error: "Name is required" })
            .trim()
            .min(1, "Name is required"),
        email: zod_1.z
            .string({ required_error: "Email is required" })
            .trim()
            .toLowerCase()
            .email("Invalid email format"),
        password: zod_1.z
            .string({ required_error: "Password is required" })
            .min(8, "Password must be at least 8 characters"),
        role: zod_1.z
            .enum([user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN])
            .optional()
            .default(user_1.USER_ROLES.ADMIN),
        phone: zod_1.z.string().trim().optional(),
        countryCode: zod_1.z.string().trim().optional(),
        profileImage: zod_1.z.string().optional(),
        timezone: zod_1.z.string().trim().optional(),
    }),
});
const createUserZodSchema = zod_1.z.object({
    body: auth_validation_1.signUpBodyZodSchema,
});
const updateProfileZodSchema = zod_1.z.object({
    body: zod_1.z.object(Object.assign({ name: zod_1.z.string().trim().min(1, "Name cannot be empty").optional(), password: zod_1.z
            .string()
            .min(6, "Password must be at least 6 characters")
            .optional() }, optionalUserFields)),
});
const updateUserStatusZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        status: zod_1.z.nativeEnum(user_1.STATUS, {
            required_error: "Status is required (active or inactive)",
        }),
    }),
});
const updateApprovalStatusZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        approvalStatus: zod_1.z.preprocess((val) => (typeof val === "string" ? val.toLowerCase().trim() : val), zod_1.z.nativeEnum(user_1.APPROVAL_STATUS, {
            required_error: "approvalStatus is required and must be 'approved', 'rejected', or 'pending'",
        })),
        rejectionReason: zod_1.z.string().trim().optional(),
    }),
});
const addProjectPhotoZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        image: zod_1.z.string().trim().optional(),
        projectPhoto: zod_1.z.string().trim().optional(),
        title: zod_1.z
            .string({ required_error: "Title is required" })
            .trim()
            .min(1, "Title cannot be empty"),
        category: zod_1.z
            .string({ required_error: "Category ID is required" })
            .regex(objectIdRegex, "Invalid category ID"),
    }),
});
const updateProjectPhotoZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        image: zod_1.z.string().trim().optional(),
        projectPhoto: zod_1.z.string().trim().optional(),
        title: zod_1.z.string().trim().min(1, "Title cannot be empty").optional(),
        category: zod_1.z.string().regex(objectIdRegex, "Invalid category ID").optional(),
    }),
});
exports.UserValidation = {
    createAdminZodSchema,
    createUserZodSchema,
    updateProfileZodSchema,
    updateUserStatusZodSchema,
    updateApprovalStatusZodSchema,
    addProjectPhotoZodSchema,
    updateProjectPhotoZodSchema,
};
