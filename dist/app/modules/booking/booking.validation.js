"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingValidation = void 0;
const zod_1 = require("zod");
const booking_constant_1 = require("./booking.constant");
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
const paymentMethodSchema = zod_1.z.preprocess((val) => (typeof val === "string" ? (0, booking_constant_1.normalizePaymentMethod)(val) : val), zod_1.z.nativeEnum(booking_constant_1.BOOKING_PAYMENT_METHOD, {
    errorMap: () => ({
        message: `Invalid payment method. Allowed: ${Object.values(booking_constant_1.BOOKING_PAYMENT_METHOD).join(", ")}`,
    }),
}));
const rescheduleBookingZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        appointmentDate: zod_1.z.preprocess(parseDate, zod_1.z.date({ required_error: "New appointment date is required" })),
        arrivalTimeWindow: zod_1.z
            .string({ required_error: "Arrival time window is required" })
            .trim()
            .min(1, "Arrival time window is required"),
        paymentMethod: paymentMethodSchema.optional(),
    }),
});
const cancelBookingZodSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        reason: zod_1.z.string().trim().optional(),
    })
        .optional(),
});
const markWorkCompleteZodSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        completionNote: zod_1.z.string().trim().optional(),
    })
        .optional(),
});
const confirmCompletionZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        paymentMethod: paymentMethodSchema.optional().default(booking_constant_1.BOOKING_PAYMENT_METHOD.CASH),
        isPaidDirectly: zod_1.z.boolean().optional(),
        isSatisfactionConfirmed: zod_1.z.boolean().optional(),
    }),
});
exports.BookingValidation = {
    paymentMethodSchema,
    rescheduleBookingZodSchema,
    cancelBookingZodSchema,
    markWorkCompleteZodSchema,
    confirmCompletionZodSchema,
};
