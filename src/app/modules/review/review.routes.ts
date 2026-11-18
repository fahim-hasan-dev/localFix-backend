import express from "express";
import auth from "../../middlewares/auth";
import optionalAuth from "../../middlewares/optionalAuth";
import validateRequest from "../../middlewares/validateRequest";
import { USER_ROLES } from "../../../enums/user";
import { ReviewValidation } from "./review.validation";
import { ReviewController } from "./review.controller";

const router = express.Router();

const proRoles = [
  USER_ROLES.PROFESSIONAL,
  USER_ROLES.ADMIN,
  USER_ROLES.SUPER_ADMIN,
];

const allReviewRoles = [
  USER_ROLES.HOME_OWNER,
  USER_ROLES.PROFESSIONAL,
  USER_ROLES.ADMIN,
  USER_ROLES.SUPER_ADMIN,
];

// 1. Homeowner: Create review for a completed job
router.post(
  "/",
  auth(USER_ROLES.HOME_OWNER),
  validateRequest(ReviewValidation.createReviewZodSchema),
  ReviewController.createReview,
);

// 2. User reviews (Homeowner submitted reviews OR Professional received reviews with Tab Counts & Breakdown)
router.get(
  "/my-reviews",
  auth(...allReviewRoles),
  ReviewController.getMyReviews,
);

// 3. Professional: Reply to a review (Post/Edit response)
router.patch(
  "/:id/reply",
  auth(...proRoles),
  validateRequest(ReviewValidation.replyReviewZodSchema),
  ReviewController.replyToReview,
);

router.delete(
  "/:id/reply",
  auth(...proRoles),
  ReviewController.deleteReply,
);

// 4. Booking specific review
router.get(
  "/booking/:bookingId",
  optionalAuth(),
  ReviewController.getReviewByBookingId,
);

// 5. Professional Review Summary
router.get(
  "/professional/:professionalId/summary",
  optionalAuth(),
  ReviewController.getProfessionalReviewSummary,
);

router.get(
  "/contractor/:contractorId/summary",
  optionalAuth(),
  ReviewController.getProfessionalReviewSummary,
);

// 6. Reviews by Professional ID (Screenshot 5)
router.get(
  "/professional/:professionalId",
  optionalAuth(),
  ReviewController.getProfessionalReviews,
);

router.get(
  "/contractor/:contractorId",
  optionalAuth(),
  ReviewController.getProfessionalReviews,
);

// 7. Single review by ID
router.get("/:id", optionalAuth(), ReviewController.getSingleReview);

export const ReviewRoutes = router;
