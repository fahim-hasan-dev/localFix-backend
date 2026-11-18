import express from "express";
import {
  isAuthenticated,
  isHomeOwner,
  isProfessional,
} from "../../../helpers/authHelper";
import validateRequest from "../../middlewares/validateRequest";
import { BookingController } from "./booking.controller";
import { BookingValidation } from "./booking.validation";

const router = express.Router();

router.get("/my-bookings", isAuthenticated, BookingController.getMyBookings);
router.get("/pro/my-bookings", isProfessional, BookingController.getMyBookings);
router.get("/", isAuthenticated, BookingController.getMyBookings);

router.get("/:id", isAuthenticated, BookingController.getBookingById);

router.get(
  "/:id/verify-payment",
  isAuthenticated,
  BookingController.verifyPayment,
);

// Homeowner actions
router.patch(
  "/:id/reschedule",
  isHomeOwner,
  validateRequest(BookingValidation.rescheduleBookingZodSchema),
  BookingController.rescheduleBooking,
);

// Cancel booking using DELETE method
router.delete(
  "/:id/cancel",
  isHomeOwner,
  validateRequest(BookingValidation.cancelBookingZodSchema),
  BookingController.cancelBooking,
);

router.patch(
  "/:id/confirm-completion",
  isHomeOwner,
  validateRequest(BookingValidation.confirmCompletionZodSchema),
  BookingController.confirmCompletion,
);

router.post(
  "/:id/confirm-completion",
  isHomeOwner,
  validateRequest(BookingValidation.confirmCompletionZodSchema),
  BookingController.confirmCompletion,
);

// Professional actions
router.patch("/:id/on-the-way", isProfessional, BookingController.onTheWay);

router.patch("/:id/start-work", isProfessional, BookingController.startWork);

router.patch(
  "/:id/complete-work",
  isProfessional,
  validateRequest(BookingValidation.markWorkCompleteZodSchema),
  BookingController.completeWork,
);

export const BookingRoutes = router;
