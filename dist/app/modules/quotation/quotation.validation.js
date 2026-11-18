"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuotationValidation = void 0;
const zod_1 = require("zod");
const booking_constant_1 = require("../booking/booking.constant");
const quotation_constant_1 = require("./quotation.constant");
const parseNumber = (val) => {
    if (val === undefined || val === null || val === "")
        return undefined;
    if (typeof val === "string") {
        const cleaned = val.replace(/[^0-9.]/g, "");
        const num = Number(cleaned);
        return isNaN(num) ? undefined : num;
    }
    return Number(val);
};
const parseDate = (val) => {
    if (val === undefined || val === null || val === "")
        return undefined;
    if (val instanceof Date)
        return val;
    if (typeof val === "string") {
        const d = new Date(val);
        return isNaN(d.getTime()) ? undefined : d;
    }
    return undefined;
};
const normalizePriceType = (val) => {
    if (typeof val !== "string")
        return val;
    const cleaned = val
        .trim()
        .toLowerCase()
        .replace(/[\s_-]/g, "");
    if (cleaned === "estimate")
        return quotation_constant_1.QUOTATION_PRICE_TYPE.ESTIMATE;
    if (cleaned === "fixed")
        return quotation_constant_1.QUOTATION_PRICE_TYPE.FIXED;
    if (cleaned === "hourly")
        return quotation_constant_1.QUOTATION_PRICE_TYPE.HOURLY;
    if (cleaned === "timeandmaterials" || cleaned === "timeandmaterial") {
        return quotation_constant_1.QUOTATION_PRICE_TYPE.TIME_AND_MATERIALS;
    }
    return val.trim().toLowerCase();
};
const normalizePartsMaterials = (val) => {
    if (typeof val !== "string")
        return val;
    const cleaned = val.trim().toLowerCase();
    if (cleaned.includes("labour") || cleaned.includes("labor")) {
        return quotation_constant_1.QUOTATION_PARTS_MATERIALS.LABOR_ONLY;
    }
    if (cleaned.includes("parts") ||
        cleaned.includes("fittings") ||
        cleaned.startsWith("yes")) {
        return quotation_constant_1.QUOTATION_PARTS_MATERIALS.PARTS_INCLUDED;
    }
    return cleaned;
};
const createQuotationZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        jobRequest: zod_1.z
            .string({ required_error: "Job request ID is required" })
            .trim()
            .min(1, "Job request ID is required"),
        priceType: zod_1.z.preprocess(normalizePriceType, zod_1.z.nativeEnum(quotation_constant_1.QUOTATION_PRICE_TYPE, {
            required_error: "Price type is required (estimate, fixed, hourly, timeandmaterials)",
        })),
        totalRate: zod_1.z.preprocess(parseNumber, zod_1.z
            .number({ required_error: "Total / Rate is required" })
            .min(0, "Total rate cannot be negative")),
        scopeOfWork: zod_1.z
            .string({ required_error: "Scope of work is required" })
            .trim()
            .min(1, "Scope of work is required"),
        exclusions: zod_1.z.string().trim().optional(),
        partsAndMaterialsIncluded: zod_1.z.preprocess(normalizePartsMaterials, zod_1.z.nativeEnum(quotation_constant_1.QUOTATION_PARTS_MATERIALS, {
            required_error: "Parts & materials preference is required (parts_included, labor_only)",
        })),
        estimatedDuration: zod_1.z
            .string({ required_error: "Estimated duration is required" })
            .trim()
            .min(1, "Estimated duration is required"),
        earliestAvailableDate: zod_1.z.preprocess(parseDate, zod_1.z.date({ required_error: "Earliest available date is required" })),
        arrivalTimeWindow: zod_1.z
            .string({ required_error: "Arrival time window is required" })
            .trim()
            .min(1, "Arrival time window is required"),
        warranty: zod_1.z.string().trim().optional(),
        offerValidUntil: zod_1.z
            .preprocess(parseDate, zod_1.z.date().optional())
            .refine((date) => !date || date.getTime() > Date.now(), {
            message: "Offer valid until date must be in the future",
        })
            .optional(),
        additionalNotes: zod_1.z.string().trim().optional(),
    }),
});
const acceptQuotationZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        appointmentDate: zod_1.z.preprocess(parseDate, zod_1.z.date().optional()).optional(),
        paymentMethod: zod_1.z
            .preprocess((val) => (typeof val === "string" ? (0, booking_constant_1.normalizePaymentMethod)(val) : val), zod_1.z.nativeEnum(booking_constant_1.BOOKING_PAYMENT_METHOD).optional())
            .optional(),
        arrivalTimeWindow: zod_1.z.string().trim().optional(),
    }),
});
const declineQuotationZodSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        reason: zod_1.z.string().trim().optional(),
    })
        .optional(),
});
exports.QuotationValidation = {
    createQuotationZodSchema,
    acceptQuotationZodSchema,
    declineQuotationZodSchema,
};
