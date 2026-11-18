"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobRequestValidation = void 0;
const zod_1 = require("zod");
const jobRequest_1 = require("../../../enums/jobRequest");
const serviceLocationValidationSchema = zod_1.z.object({
    zipCode: zod_1.z
        .string({ required_error: "Zip code is required" })
        .trim()
        .min(1, "Zip code is required"),
    address: zod_1.z.string().trim().optional(),
    city: zod_1.z.string().trim().optional(),
    state: zod_1.z.string().trim().optional(),
    location: zod_1.z
        .object({
        type: zod_1.z.literal("Point").default("Point"),
        coordinates: zod_1.z.tuple([zod_1.z.number(), zod_1.z.number()]),
        address: zod_1.z.string().optional(),
    })
        .optional(),
});
const estimatedBudgetSchema = zod_1.z.preprocess((val) => {
    if (val === undefined || val === null || val === "")
        return undefined;
    if (typeof val === "string") {
        const cleaned = val.replace(/[^0-9.]/g, "");
        const num = Number(cleaned);
        return isNaN(num) ? undefined : num;
    }
    return Number(val);
}, zod_1.z.number().min(0, "Estimated budget must be a positive number").optional());
const createJobRequestZodSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        category: zod_1.z
            .string({ required_error: "Trade category is required" })
            .trim()
            .min(1, "Trade category is required"),
        headline: zod_1.z
            .string()
            .trim()
            .min(1, "Project headline is required")
            .optional(),
        title: zod_1.z.string().trim().min(1, "Project title is required").optional(),
        description: zod_1.z
            .string({ required_error: "Detailed work description is required" })
            .trim()
            .min(1, "Work description is required"),
        projectPhotos: zod_1.z.array(zod_1.z.string()).optional(),
        timeframe: zod_1.z
            .string({ required_error: "Timeframe is required" })
            .trim()
            .min(1, "Timeframe is required"),
        serviceLocation: serviceLocationValidationSchema.optional(),
        zipCode: zod_1.z.string().trim().optional(),
        address: zod_1.z.string().trim().optional(),
        city: zod_1.z.string().trim().optional(),
        state: zod_1.z.string().trim().optional(),
        preferredArrivalWindow: zod_1.z.string().trim().optional(),
        propertyType: zod_1.z
            .string({ required_error: "Property type is required" })
            .trim()
            .min(1, "Property type is required"),
        partsAndMaterials: zod_1.z
            .string({ required_error: "Parts & materials preference is required" })
            .trim()
            .min(1, "Parts & materials preference is required"),
        estimatedBudget: estimatedBudgetSchema,
        professional: zod_1.z.preprocess((val) => {
            if (val === "" || val === "null" || val === "undefined") {
                return undefined;
            }
            return val;
        }, zod_1.z.string().trim().optional().nullable()),
    })
        .refine((data) => Boolean(data.headline || data.title), {
        message: "Project headline or title is required",
        path: ["headline"],
    })
        .refine((data) => { var _a; return Boolean(((_a = data.serviceLocation) === null || _a === void 0 ? void 0 : _a.zipCode) || data.zipCode); }, {
        message: "Service location ZIP code is required",
        path: ["zipCode"],
    }),
});
const updateJobRequestZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        category: zod_1.z.string().trim().optional(),
        headline: zod_1.z.string().trim().optional(),
        title: zod_1.z.string().trim().optional(),
        description: zod_1.z.string().trim().optional(),
        projectPhotos: zod_1.z.array(zod_1.z.string()).optional(),
        timeframe: zod_1.z.string().trim().optional(),
        serviceLocation: serviceLocationValidationSchema.partial().optional(),
        zipCode: zod_1.z.string().trim().optional(),
        address: zod_1.z.string().trim().optional(),
        city: zod_1.z.string().trim().optional(),
        state: zod_1.z.string().trim().optional(),
        preferredArrivalWindow: zod_1.z.string().trim().optional(),
        propertyType: zod_1.z.string().trim().optional(),
        partsAndMaterials: zod_1.z.string().trim().optional(),
        estimatedBudget: estimatedBudgetSchema,
        professional: zod_1.z.preprocess((val) => {
            if (val === "" || val === "null" || val === "undefined") {
                return undefined;
            }
            return val;
        }, zod_1.z.string().trim().optional().nullable()),
        status: zod_1.z.nativeEnum(jobRequest_1.JOB_REQUEST_STATUS).optional(),
    }),
});
exports.JobRequestValidation = {
    createJobRequestZodSchema,
    updateJobRequestZodSchema,
};
