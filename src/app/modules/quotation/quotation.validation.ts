import { z } from "zod";
import {
  BOOKING_PAYMENT_METHOD,
  normalizePaymentMethod,
} from "../booking/booking.constant";
import {
  QUOTATION_PARTS_MATERIALS,
  QUOTATION_PRICE_TYPE,
} from "./quotation.constant";

const parseNumber = (val: unknown) => {
  if (val === undefined || val === null || val === "") return undefined;
  if (typeof val === "string") {
    const cleaned = val.replace(/[^0-9.]/g, "");
    const num = Number(cleaned);
    return isNaN(num) ? undefined : num;
  }
  return Number(val);
};

const parseDate = (val: unknown) => {
  if (val === undefined || val === null || val === "") return undefined;
  if (val instanceof Date) return val;
  if (typeof val === "string") {
    const d = new Date(val);
    return isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
};

const normalizePriceType = (val: unknown) => {
  if (typeof val !== "string") return val;
  const cleaned = val
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, "");
  if (cleaned === "estimate") return QUOTATION_PRICE_TYPE.ESTIMATE;
  if (cleaned === "fixed") return QUOTATION_PRICE_TYPE.FIXED;
  if (cleaned === "hourly") return QUOTATION_PRICE_TYPE.HOURLY;
  if (cleaned === "timeandmaterials" || cleaned === "timeandmaterial") {
    return QUOTATION_PRICE_TYPE.TIME_AND_MATERIALS;
  }
  return val.trim().toLowerCase();
};

const normalizePartsMaterials = (val: unknown) => {
  if (typeof val !== "string") return val;
  const cleaned = val.trim().toLowerCase();
  if (cleaned.includes("labour") || cleaned.includes("labor")) {
    return QUOTATION_PARTS_MATERIALS.LABOR_ONLY;
  }
  if (
    cleaned.includes("parts") ||
    cleaned.includes("fittings") ||
    cleaned.startsWith("yes")
  ) {
    return QUOTATION_PARTS_MATERIALS.PARTS_INCLUDED;
  }
  return cleaned;
};

const createQuotationZodSchema = z.object({
  body: z.object({
    jobRequest: z
      .string({ required_error: "Job request ID is required" })
      .trim()
      .min(1, "Job request ID is required"),
    priceType: z.preprocess(
      normalizePriceType,
      z.nativeEnum(QUOTATION_PRICE_TYPE, {
        required_error:
          "Price type is required (estimate, fixed, hourly, timeandmaterials)",
      }),
    ),
    totalRate: z.preprocess(
      parseNumber,
      z
        .number({ required_error: "Total / Rate is required" })
        .min(0, "Total rate cannot be negative"),
    ),
    scopeOfWork: z
      .string({ required_error: "Scope of work is required" })
      .trim()
      .min(1, "Scope of work is required"),
    exclusions: z.string().trim().optional(),
    partsAndMaterialsIncluded: z.preprocess(
      normalizePartsMaterials,
      z.nativeEnum(QUOTATION_PARTS_MATERIALS, {
        required_error:
          "Parts & materials preference is required (parts_included, labor_only)",
      }),
    ),
    estimatedDuration: z
      .string({ required_error: "Estimated duration is required" })
      .trim()
      .min(1, "Estimated duration is required"),
    earliestAvailableDate: z.preprocess(
      parseDate,
      z.date({ required_error: "Earliest available date is required" }),
    ),
    arrivalTimeWindow: z
      .string({ required_error: "Arrival time window is required" })
      .trim()
      .min(1, "Arrival time window is required"),
    warranty: z.string().trim().optional(),
    offerValidUntil: z
      .preprocess(parseDate, z.date().optional())
      .refine((date) => !date || date.getTime() > Date.now(), {
        message: "Offer valid until date must be in the future",
      })
      .optional(),
    additionalNotes: z.string().trim().optional(),
  }),
});

const acceptQuotationZodSchema = z.object({
  body: z.object({
    appointmentDate: z.preprocess(parseDate, z.date().optional()).optional(),
    paymentMethod: z
      .preprocess(
        (val) => (typeof val === "string" ? normalizePaymentMethod(val) : val),
        z.nativeEnum(BOOKING_PAYMENT_METHOD).optional(),
      )
      .optional(),
    arrivalTimeWindow: z.string().trim().optional(),
  }),
});

const declineQuotationZodSchema = z.object({
  body: z
    .object({
      reason: z.string().trim().optional(),
    })
    .optional(),
});

export const QuotationValidation = {
  createQuotationZodSchema,
  acceptQuotationZodSchema,
  declineQuotationZodSchema,
};
