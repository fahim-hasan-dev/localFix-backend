"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewController = void 0;
const http_status_codes_1 = require("http-status-codes");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const ApiErrors_1 = __importDefault(require("../../../errors/ApiErrors"));
const review_service_1 = require("./review.service");
/**
 * 1. Create Review (Homeowner submits review & rating for Professional on completed & confirmed job)
 */
const createReview = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, "User not authenticated");
    }
    const result = yield review_service_1.ReviewService.createReviewIntoDB(req.user, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.CREATED,
        success: true,
        message: "Review submitted successfully",
        data: result,
    });
}));
/**
 * 2. Professional replies to a review (Screenshots 2, 3, 4)
 */
const replyToReview = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if (!req.user) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, "User not authenticated");
    }
    const proUserId = (_a = (req.user.userId || req.user.id)) === null || _a === void 0 ? void 0 : _a.toString();
    const replyText = req.body.reply || req.body.comment || req.body.response;
    if (!replyText || typeof replyText !== "string" || !replyText.trim()) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Reply message is required and cannot be empty");
    }
    const result = yield review_service_1.ReviewService.replyToReviewInDB(req.params.id, proUserId, replyText);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Reply posted successfully",
        data: result,
    });
}));
/**
 * 3. Delete Reply to a review
 */
const deleteReply = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if (!req.user) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, "User not authenticated");
    }
    const proUserId = (_a = (req.user.userId || req.user.id)) === null || _a === void 0 ? void 0 : _a.toString();
    const result = yield review_service_1.ReviewService.deleteReplyFromDB(req.params.id, proUserId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Reply removed successfully",
        data: result,
    });
}));
/**
 * 4. Get Reviews for a Professional (Screenshot 5)
 */
const getProfessionalReviews = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const professionalId = req.params.professionalId || req.params.contractorId;
    const result = yield review_service_1.ReviewService.getProfessionalReviewsFromDB(professionalId, req.query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Professional reviews retrieved successfully",
        meta: result.meta,
        data: {
            summary: result.summary,
            reviews: result.data,
        },
    });
}));
/**
 * 5. Get Professional Review Summary & Star Breakdown
 */
const getProfessionalReviewSummary = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const professionalId = req.params.professionalId || req.params.contractorId;
    const result = yield review_service_1.ReviewService.getProfessionalReviewSummaryFromDB(professionalId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Professional review summary retrieved successfully",
        data: result,
    });
}));
/**
 * 6. Get Review by Booking ID
 */
const getReviewByBookingId = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield review_service_1.ReviewService.getReviewByBookingIdFromDB(req.params.bookingId || req.params.maintenanceId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: result
            ? "Booking review retrieved successfully"
            : "No review found for this booking",
        data: result,
    });
}));
/**
 * 7. Get My Reviews (Branches based on user role)
 */
const getMyReviews = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, "User not authenticated");
    }
    const result = yield review_service_1.ReviewService.getMyReviewsFromDB(req.user, req.query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
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
}));
/**
 * 8. Get Single Review by ID
 */
const getSingleReview = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield review_service_1.ReviewService.getSingleReviewFromDB(req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Review retrieved successfully",
        data: result,
    });
}));
exports.ReviewController = {
    createReview,
    replyToReview,
    deleteReply,
    getProfessionalReviews,
    getProfessionalReviewSummary,
    getReviewByBookingId,
    getMyReviews,
    getSingleReview,
};
