"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingRoutes = void 0;
const express_1 = __importDefault(require("express"));
const authHelper_1 = require("../../../helpers/authHelper");
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const booking_controller_1 = require("./booking.controller");
const booking_validation_1 = require("./booking.validation");
const router = express_1.default.Router();
router.get("/my-bookings", authHelper_1.isAuthenticated, booking_controller_1.BookingController.getMyBookings);
router.get("/pro/my-bookings", authHelper_1.isProfessional, booking_controller_1.BookingController.getMyBookings);
router.get("/", authHelper_1.isAuthenticated, booking_controller_1.BookingController.getMyBookings);
router.get("/:id", authHelper_1.isAuthenticated, booking_controller_1.BookingController.getBookingById);
router.get("/:id/verify-payment", authHelper_1.isAuthenticated, booking_controller_1.BookingController.verifyPayment);
// Homeowner actions
router.patch("/:id/reschedule", authHelper_1.isHomeOwner, (0, validateRequest_1.default)(booking_validation_1.BookingValidation.rescheduleBookingZodSchema), booking_controller_1.BookingController.rescheduleBooking);
// Cancel booking using DELETE method
router.delete("/:id/cancel", authHelper_1.isHomeOwner, (0, validateRequest_1.default)(booking_validation_1.BookingValidation.cancelBookingZodSchema), booking_controller_1.BookingController.cancelBooking);
router.patch("/:id/confirm-completion", authHelper_1.isHomeOwner, (0, validateRequest_1.default)(booking_validation_1.BookingValidation.confirmCompletionZodSchema), booking_controller_1.BookingController.confirmCompletion);
router.post("/:id/confirm-completion", authHelper_1.isHomeOwner, (0, validateRequest_1.default)(booking_validation_1.BookingValidation.confirmCompletionZodSchema), booking_controller_1.BookingController.confirmCompletion);
// Professional actions
router.patch("/:id/on-the-way", authHelper_1.isProfessional, booking_controller_1.BookingController.onTheWay);
router.patch("/:id/start-work", authHelper_1.isProfessional, booking_controller_1.BookingController.startWork);
router.patch("/:id/complete-work", authHelper_1.isProfessional, (0, validateRequest_1.default)(booking_validation_1.BookingValidation.markWorkCompleteZodSchema), booking_controller_1.BookingController.completeWork);
exports.BookingRoutes = router;
