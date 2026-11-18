"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewValidation = void 0;
const zod_1 = require("zod");
const createReviewZodSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        bookingId: zod_1.z.string().optional(),
        booking: zod_1.z.string().optional(),
        jobRequestId: zod_1.z.string().optional(),
        jobRequest: zod_1.z.string().optional(),
        rating: zod_1.z
            .number({
            required_error: "Rating is required",
        })
            .int("Rating must be an integer (1, 2, 3, 4, or 5). Float is not allowed")
            .min(1, "Rating must be at least 1")
            .max(5, "Rating cannot exceed 5"),
        feedback: zod_1.z.string().trim().optional(),
    })
        .refine((data) => Boolean(data.bookingId ||
        data.booking ||
        data.jobRequestId ||
        data.jobRequest), {
        message: "Booking or Job ID is required to submit a review",
        path: ["bookingId"],
    }),
});
const replyReviewZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        reply: zod_1.z
            .string({
            required_error: "Reply message is required",
        })
            .trim()
            .min(1, "Reply message cannot be empty")
            .max(1500, "Reply cannot exceed 1500 characters"),
    }),
});
exports.ReviewValidation = {
    createReviewZodSchema,
    replyReviewZodSchema,
};
