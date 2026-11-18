import { z } from "zod";

const createReviewZodSchema = z.object({
  body: z
    .object({
      bookingId: z.string().optional(),
      booking: z.string().optional(),
      jobRequestId: z.string().optional(),
      jobRequest: z.string().optional(),
      rating: z
        .number({
          required_error: "Rating is required",
        })
        .int(
          "Rating must be an integer (1, 2, 3, 4, or 5). Float is not allowed",
        )
        .min(1, "Rating must be at least 1")
        .max(5, "Rating cannot exceed 5"),
      feedback: z.string().trim().optional(),
    })
    .refine(
      (data) =>
        Boolean(
          data.bookingId ||
            data.booking ||
            data.jobRequestId ||
            data.jobRequest,
        ),
      {
        message: "Booking or Job ID is required to submit a review",
        path: ["bookingId"],
      },
    ),
});

const replyReviewZodSchema = z.object({
  body: z.object({
    reply: z
      .string({
        required_error: "Reply message is required",
      })
      .trim()
      .min(1, "Reply message cannot be empty")
      .max(1500, "Reply cannot exceed 1500 characters"),
  }),
});

export const ReviewValidation = {
  createReviewZodSchema,
  replyReviewZodSchema,
};
