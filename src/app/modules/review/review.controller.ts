import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import ApiError from "../../../errors/ApiErrors";
import { ReviewService } from "./review.service";

/**
 * 1. Create Review (Homeowner submits review & rating for Professional on completed & confirmed job)
 */
const createReview = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "User not authenticated");
  }

  const result = await ReviewService.createReviewIntoDB(req.user, req.body);

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: "Review submitted successfully",
    data: result,
  });
});

/**
 * 2. Professional replies to a review (Screenshots 2, 3, 4)
 */
const replyToReview = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "User not authenticated");
  }

  const proUserId = (req.user.userId || req.user.id)?.toString();
  const replyText = req.body.reply || req.body.comment || req.body.response;

  if (!replyText || typeof replyText !== "string" || !replyText.trim()) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Reply message is required and cannot be empty",
    );
  }

  const result = await ReviewService.replyToReviewInDB(
    req.params.id,
    proUserId,
    replyText,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Reply posted successfully",
    data: result,
  });
});

/**
 * 3. Delete Reply to a review
 */
const deleteReply = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "User not authenticated");
  }

  const proUserId = (req.user.userId || req.user.id)?.toString();
  const result = await ReviewService.deleteReplyFromDB(
    req.params.id,
    proUserId,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Reply removed successfully",
    data: result,
  });
});

/**
 * 4. Get Reviews for a Professional (Screenshot 5)
 */
const getProfessionalReviews = catchAsync(
  async (req: Request, res: Response) => {
    const professionalId =
      req.params.professionalId || req.params.contractorId;
    const result = await ReviewService.getProfessionalReviewsFromDB(
      professionalId,
      req.query,
    );

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "Professional reviews retrieved successfully",
      meta: result.meta,
      data: {
        summary: result.summary,
        reviews: result.data,
      },
    });
  },
);

/**
 * 5. Get Professional Review Summary & Star Breakdown
 */
const getProfessionalReviewSummary = catchAsync(
  async (req: Request, res: Response) => {
    const professionalId =
      req.params.professionalId || req.params.contractorId;
    const result =
      await ReviewService.getProfessionalReviewSummaryFromDB(professionalId);

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "Professional review summary retrieved successfully",
      data: result,
    });
  },
);

/**
 * 6. Get Review by Booking ID
 */
const getReviewByBookingId = catchAsync(
  async (req: Request, res: Response) => {
    const result = await ReviewService.getReviewByBookingIdFromDB(
      req.params.bookingId || req.params.maintenanceId,
    );

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: result
        ? "Booking review retrieved successfully"
        : "No review found for this booking",
      data: result,
    });
  },
);

/**
 * 7. Get My Reviews (Branches based on user role)
 */
const getMyReviews = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "User not authenticated");
  }

  const result: any = await ReviewService.getMyReviewsFromDB(
    req.user,
    req.query,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "My reviews retrieved successfully",
    meta: result.meta,
    data: result.tabCounts
      ? {
          summary: result.summary,
          tabCounts: result.tabCounts,
          activeTab: result.activeTab,
          reviews: result.data,
        }
      : result.data,
  });
});

/**
 * 8. Get Single Review by ID
 */
const getSingleReview = catchAsync(async (req: Request, res: Response) => {
  const result = await ReviewService.getSingleReviewFromDB(req.params.id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Review retrieved successfully",
    data: result,
  });
});

export const ReviewController = {
  createReview,
  replyToReview,
  deleteReply,
  getProfessionalReviews,
  getProfessionalReviewSummary,
  getReviewByBookingId,
  getMyReviews,
  getSingleReview,
};
