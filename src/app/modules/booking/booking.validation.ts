import { z } from "zod";
import {
  BOOKING_PAYMENT_METHOD,
  normalizePaymentMethod,
} from "./booking.constant";

const parseDate = (val: unknown) => {
  if (val === undefined || val === null || val === "") return undefined;
  if (val instanceof Date) return val;
  if (typeof val === "string") {
    const d = new Date(val);
    return isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
};

const paymentMethodSchema = z.preprocess(
  (val) => (typeof val === "string" ? normalizePaymentMethod(val) : val),
  z.nativeEnum(BOOKING_PAYMENT_METHOD, {
    errorMap: () => ({
      message: `Invalid payment method. Allowed: ${Object.values(BOOKING_PAYMENT_METHOD).join(", ")}`,
    }),
  }),
);

const rescheduleBookingZodSchema = z.object({
  body: z.object({
    appointmentDate: z.preprocess(
      parseDate,
      z.date({ required_error: "New appointment date is required" }),
    ),
    arrivalTimeWindow: z
      .string({ required_error: "Arrival time window is required" })
      .trim()
      .min(1, "Arrival time window is required"),
    paymentMethod: paymentMethodSchema.optional(),
  }),
});

const cancelBookingZodSchema = z.object({
  body: z
    .object({
      reason: z.string().trim().optional(),
    })
    .optional(),
});

const markWorkCompleteZodSchema = z.object({
  body: z
    .object({
      completionNote: z.string().trim().optional(),
    })
    .optional(),
});

const confirmCompletionZodSchema = z.object({
  body: z.object({
    paymentMethod: paymentMethodSchema.optional().default(BOOKING_PAYMENT_METHOD.CASH),
    isPaidDirectly: z.boolean().optional(),
    isSatisfactionConfirmed: z.boolean().optional(),
  }),
});

export const BookingValidation = {
  paymentMethodSchema,
  rescheduleBookingZodSchema,
  cancelBookingZodSchema,
  markWorkCompleteZodSchema,
  confirmCompletionZodSchema,
};
