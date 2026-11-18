"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewRoutes = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../../middlewares/auth"));
const optionalAuth_1 = __importDefault(require("../../middlewares/optionalAuth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const user_1 = require("../../../enums/user");
const review_validation_1 = require("./review.validation");
const review_controller_1 = require("./review.controller");
const router = express_1.default.Router();
const proRoles = [
    user_1.USER_ROLES.PROFESSIONAL,
    user_1.USER_ROLES.ADMIN,
    user_1.USER_ROLES.SUPER_ADMIN,
];
const allReviewRoles = [
    user_1.USER_ROLES.HOME_OWNER,
    user_1.USER_ROLES.PROFESSIONAL,
    user_1.USER_ROLES.ADMIN,
    user_1.USER_ROLES.SUPER_ADMIN,
];
// 1. Homeowner: Create review for a completed job
router.post("/", (0, auth_1.default)(user_1.USER_ROLES.HOME_OWNER), (0, validateRequest_1.default)(review_validation_1.ReviewValidation.createReviewZodSchema), review_controller_1.ReviewController.createReview);
// 2. User reviews (Homeowner submitted reviews OR Professional received reviews with Tab Counts & Breakdown)
router.get("/my-reviews", (0, auth_1.default)(...allReviewRoles), review_controller_1.ReviewController.getMyReviews);
// 3. Professional: Reply to a review (Post/Edit response)
router.patch("/:id/reply", (0, auth_1.default)(...proRoles), (0, validateRequest_1.default)(review_validation_1.ReviewValidation.replyReviewZodSchema), review_controller_1.ReviewController.replyToReview);
router.delete("/:id/reply", (0, auth_1.default)(...proRoles), review_controller_1.ReviewController.deleteReply);
// 4. Booking specific review
router.get("/booking/:bookingId", (0, optionalAuth_1.default)(), review_controller_1.ReviewController.getReviewByBookingId);
// 5. Professional Review Summary
router.get("/professional/:professionalId/summary", (0, optionalAuth_1.default)(), review_controller_1.ReviewController.getProfessionalReviewSummary);
router.get("/contractor/:contractorId/summary", (0, optionalAuth_1.default)(), review_controller_1.ReviewController.getProfessionalReviewSummary);
// 6. Reviews by Professional ID (Screenshot 5)
router.get("/professional/:professionalId", (0, optionalAuth_1.default)(), review_controller_1.ReviewController.getProfessionalReviews);
router.get("/contractor/:contractorId", (0, optionalAuth_1.default)(), review_controller_1.ReviewController.getProfessionalReviews);
// 7. Single review by ID
router.get("/:id", (0, optionalAuth_1.default)(), review_controller_1.ReviewController.getSingleReview);
exports.ReviewRoutes = router;
