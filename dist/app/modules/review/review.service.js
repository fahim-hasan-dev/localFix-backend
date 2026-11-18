"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
exports.ReviewService = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const http_status_codes_1 = require("http-status-codes");
const ApiErrors_1 = __importDefault(require("../../../errors/ApiErrors"));
const user_1 = require("../../../enums/user");
const user_model_1 = require("../user/user.model");
const booking_model_1 = require("../booking/booking.model");
const booking_constant_1 = require("../booking/booking.constant");
const jobRequest_model_1 = require("../jobRequest/jobRequest.model");
const notificationsHelper_1 = require("../../../helpers/notificationsHelper");
const notification_constant_1 = require("../notification/notification.constant");
const queryBuilder_1 = __importDefault(require("../../builder/queryBuilder"));
const review_constant_1 = require("./review.constant");
const review_model_1 = require("./review.model");
const formatReviewItem = (review) => {
    const plain = review.toObject ? review.toObject() : Object.assign({}, review);
    const homeownerUser = plain.homeowner || plain.tenant;
    const professionalUser = plain.professional || plain.contractor;
    delete plain.tenant;
    delete plain.contractor;
    delete plain.maintenance;
    return Object.assign(Object.assign({}, plain), { homeowner: homeownerUser, professional: professionalUser, isReplied: Boolean(plain.isReplied || (plain.reply && plain.reply.trim().length > 0)), reply: plain.reply || null, repliedAt: plain.repliedAt || null });
};
const createReviewIntoDB = (authUser, payload) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    if (authUser.role !== user_1.USER_ROLES.HOME_OWNER) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "Only homeowners can submit a review for a professional");
    }
    const homeownerId = (_a = (authUser.userId || authUser.id)) === null || _a === void 0 ? void 0 : _a.toString();
    if (!homeownerId) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, "User not authenticated");
    }
    // Identify target job/booking
    const targetId = payload.bookingId ||
        payload.booking ||
        payload.jobRequestId ||
        payload.jobRequest;
    if (!targetId || !mongoose_1.default.Types.ObjectId.isValid(targetId)) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "A valid Booking or Job ID is required to submit a review");
    }
    // Find the corresponding booking
    let booking = yield booking_model_1.Booking.findOne({
        $or: [
            { _id: new mongoose_1.Types.ObjectId(targetId) },
            { jobRequest: new mongoose_1.Types.ObjectId(targetId) },
        ],
        isDeleted: { $ne: true },
    });
    if (!booking) {
        const job = yield jobRequest_model_1.JobRequest.findById(targetId);
        if (job) {
            booking = yield booking_model_1.Booking.findOne({
                jobRequest: job._id,
                isDeleted: { $ne: true },
            });
        }
    }
    if (!booking) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "No completed booking found for this job. You can only review completed jobs.");
    }
    // Check homeowner ownership
    if (booking.homeowner.toString() !== homeownerId) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "Only the homeowner of this job can submit a review");
    }
    // Only allow review after job completion is confirmed
    if (booking.status !== booking_constant_1.BOOKING_STATUS.COMPLETED) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "You can only submit a review after confirming job completion.");
    }
    // Check if a review already exists for this booking or job
    const existingReview = yield review_model_1.Review.findOne({
        $or: [
            { booking: booking._id },
            { maintenance: booking._id },
            ...(booking.jobRequest
                ? [
                    { maintenance: booking.jobRequest },
                    { jobRequest: booking.jobRequest },
                ]
                : []),
        ],
    });
    if (existingReview) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.CONFLICT, "A review has already been submitted for this job. Only one review per job is allowed.");
    }
    const professionalId = booking.professional.toString();
    if (homeownerId === professionalId) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "You cannot review or rate yourself");
    }
    const reviewData = {
        professional: new mongoose_1.Types.ObjectId(professionalId),
        homeowner: new mongoose_1.Types.ObjectId(homeownerId),
        booking: booking._id,
        jobRequest: booking.jobRequest,
        rating: payload.rating,
        feedback: ((_b = payload.feedback) === null || _b === void 0 ? void 0 : _b.trim()) || "",
        reply: null,
        repliedAt: null,
        isReplied: false,
        // Backfill legacy fields for database compatibility
        contractor: new mongoose_1.Types.ObjectId(professionalId),
        tenant: new mongoose_1.Types.ObjectId(homeownerId),
        maintenance: booking._id,
    };
    const createdReview = yield review_model_1.Review.create(reviewData);
    // Send notification to professional
    try {
        yield (0, notificationsHelper_1.sendNotifications)({
            receiver: booking.professional,
            sender: new mongoose_1.Types.ObjectId(homeownerId),
            title: "New Review Received!",
            text: `You received a ${payload.rating}-star review from your client for your completed work.`,
            type: notification_constant_1.NOTIFICATION_TYPE.PROFESSIONAL,
            referenceId: createdReview._id,
            referenceModel: "Review",
        });
    }
    catch (_c) {
        // ignore
    }
    const populatedReview = yield review_model_1.Review.findById(createdReview._id)
        .populate({
        path: "professional",
        select: "name email profileImage phone companyName",
    })
        .populate({
        path: "homeowner",
        select: "name email profileImage phone city state",
    })
        .populate({
        path: "booking",
        select: "appointmentDate arrivalTimeWindow totalAmount status",
    })
        .lean();
    return formatReviewItem(populatedReview || createdReview);
});
const replyToReviewInDB = (reviewId, proUserId, replyText) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    if (!mongoose_1.default.Types.ObjectId.isValid(reviewId)) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Invalid review ID");
    }
    const review = yield review_model_1.Review.findById(reviewId);
    if (!review) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Review not found");
    }
    const isProfessional = ((_a = review.professional) === null || _a === void 0 ? void 0 : _a.toString()) === proUserId ||
        ((_b = review.contractor) === null || _b === void 0 ? void 0 : _b.toString()) === proUserId;
    if (!isProfessional) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "You are not authorized to reply to this review");
    }
    review.reply = replyText.trim();
    review.repliedAt = new Date();
    review.isReplied = true;
    yield review.save();
    // Notify homeowner about reply
    try {
        const proUser = yield user_model_1.User.findById(proUserId)
            .select("name companyName")
            .lean();
        const proDisplayName = (proUser === null || proUser === void 0 ? void 0 : proUser.companyName) || (proUser === null || proUser === void 0 ? void 0 : proUser.name) || "Professional";
        yield (0, notificationsHelper_1.sendNotifications)({
            receiver: review.homeowner || review.tenant,
            sender: new mongoose_1.Types.ObjectId(proUserId),
            title: "Professional Replied to Your Review",
            text: `${proDisplayName} responded to your review: "${replyText.slice(0, 80)}${replyText.length > 80 ? "..." : ""}"`,
            type: notification_constant_1.NOTIFICATION_TYPE.HOME_OWNER,
            referenceId: review._id,
            referenceModel: "Review",
        });
    }
    catch (_c) {
        // ignore
    }
    const updatedReview = yield review_model_1.Review.findById(review._id)
        .populate({
        path: "professional",
        select: "name email profileImage phone companyName",
    })
        .populate({
        path: "homeowner",
        select: "name email profileImage phone city state",
    })
        .lean();
    return formatReviewItem(updatedReview || review);
});
const deleteReplyFromDB = (reviewId, proUserId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    if (!mongoose_1.default.Types.ObjectId.isValid(reviewId)) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Invalid review ID");
    }
    const review = yield review_model_1.Review.findById(reviewId);
    if (!review) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Review not found");
    }
    const isProfessional = ((_a = review.professional) === null || _a === void 0 ? void 0 : _a.toString()) === proUserId ||
        ((_b = review.contractor) === null || _b === void 0 ? void 0 : _b.toString()) === proUserId;
    if (!isProfessional) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "You are not authorized to edit this reply");
    }
    review.reply = null;
    review.repliedAt = null;
    review.isReplied = false;
    yield review.save();
    const updatedReview = yield review_model_1.Review.findById(review._id)
        .populate({
        path: "professional",
        select: "name email profileImage phone companyName",
    })
        .populate({
        path: "homeowner",
        select: "name email profileImage phone city state",
    })
        .lean();
    return formatReviewItem(updatedReview || review);
});
const getProfessionalReviewsFromDB = (proUserId, query) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if (!mongoose_1.default.Types.ObjectId.isValid(proUserId)) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Invalid professional ID");
    }
    const proObjectId = new mongoose_1.Types.ObjectId(proUserId);
    const ownedByPro = {
        $or: [{ professional: proObjectId }, { contractor: proObjectId }],
    };
    const hasReply = {
        isReplied: true,
        reply: { $nin: [null, ""] },
    };
    const needsReply = { $nor: [hasReply] };
    // Tab count aggregation. Needs-reply must stay inside this pro's reviews.
    const [allCount, needsReplyCount, repliedCount] = yield Promise.all([
        review_model_1.Review.countDocuments(ownedByPro),
        review_model_1.Review.countDocuments({ $and: [ownedByPro, needsReply] }),
        review_model_1.Review.countDocuments({ $and: [ownedByPro, hasReply] }),
    ]);
    const tabCounts = {
        all: allCount,
        needsReply: needsReplyCount,
        replied: repliedCount,
    };
    const activeTab = ((_a = query.tab) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || "all";
    const normalizedQuery = Object.assign({}, query);
    delete normalizedQuery.tab;
    const currentFilter = activeTab === "needs_reply" ||
        activeTab === "needsreply" ||
        activeTab === "unreplied"
        ? { $and: [ownedByPro, needsReply] }
        : activeTab === "replied"
            ? { $and: [ownedByPro, hasReply] }
            : Object.assign({}, ownedByPro);
    if (query.rating) {
        currentFilter.rating = Number(query.rating);
        delete normalizedQuery.rating;
    }
    const baseQuery = review_model_1.Review.find(currentFilter)
        .populate({
        path: "homeowner",
        select: "name email profileImage phone city state",
    })
        .populate({
        path: "tenant",
        select: "name email profileImage phone city state",
    })
        .populate({
        path: "professional",
        select: "name email profileImage phone companyName",
    })
        .populate({
        path: "contractor",
        select: "name email profileImage phone companyName",
    });
    const queryBuilder = new queryBuilder_1.default(baseQuery, normalizedQuery)
        .search(review_constant_1.reviewSearchableFields)
        .filter()
        .sort()
        .paginate()
        .fields();
    const [reviews, meta, summary] = yield Promise.all([
        queryBuilder.modelQuery.lean(),
        queryBuilder.countTotal(),
        review_model_1.Review.calculateAverageRating(proUserId),
    ]);
    return {
        meta,
        summary,
        tabCounts,
        activeTab,
        data: (reviews || []).map(formatReviewItem),
    };
});
const getProfessionalReviewSummaryFromDB = (professionalId) => __awaiter(void 0, void 0, void 0, function* () {
    if (!mongoose_1.default.Types.ObjectId.isValid(professionalId)) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Invalid professional ID");
    }
    return yield review_model_1.Review.calculateAverageRating(professionalId);
});
const getReviewByBookingIdFromDB = (bookingId) => __awaiter(void 0, void 0, void 0, function* () {
    if (!mongoose_1.default.Types.ObjectId.isValid(bookingId)) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Invalid booking ID");
    }
    const review = yield review_model_1.Review.findOne({
        $or: [
            { booking: new mongoose_1.Types.ObjectId(bookingId) },
            { maintenance: new mongoose_1.Types.ObjectId(bookingId) },
            { jobRequest: new mongoose_1.Types.ObjectId(bookingId) },
        ],
    })
        .populate({
        path: "professional",
        select: "name email profileImage phone companyName",
    })
        .populate({
        path: "contractor",
        select: "name email profileImage phone companyName",
    })
        .populate({
        path: "homeowner",
        select: "name email profileImage phone city state",
    })
        .populate({
        path: "tenant",
        select: "name email profileImage phone city state",
    })
        .lean();
    return review ? formatReviewItem(review) : null;
});
const getMyReviewsFromDB = (authUser, query) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const currentUserId = (_a = (authUser.userId || authUser.id)) === null || _a === void 0 ? void 0 : _a.toString();
    if (!currentUserId) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, "User not authenticated");
    }
    // If professional, return received reviews dashboard
    if (authUser.role === user_1.USER_ROLES.PROFESSIONAL) {
        return yield getProfessionalReviewsFromDB(currentUserId, query);
    }
    // If homeowner, return submitted reviews
    const baseQuery = review_model_1.Review.find({
        $or: [
            { homeowner: new mongoose_1.Types.ObjectId(currentUserId) },
            { tenant: new mongoose_1.Types.ObjectId(currentUserId) },
        ],
    })
        .populate({
        path: "professional",
        select: "name email profileImage phone companyName",
    })
        .populate({
        path: "contractor",
        select: "name email profileImage phone companyName",
    });
    const queryBuilder = new queryBuilder_1.default(baseQuery, query)
        .search(review_constant_1.reviewSearchableFields)
        .filter()
        .sort()
        .paginate()
        .fields();
    const [reviews, meta] = yield Promise.all([
        queryBuilder.modelQuery.lean(),
        queryBuilder.countTotal(),
    ]);
    return {
        meta,
        data: (reviews || []).map(formatReviewItem),
    };
});
const getSingleReviewFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Invalid review ID");
    }
    const review = yield review_model_1.Review.findById(id)
        .populate({
        path: "professional",
        select: "name email profileImage phone companyName",
    })
        .populate({
        path: "contractor",
        select: "name email profileImage phone companyName",
    })
        .populate({
        path: "homeowner",
        select: "name email profileImage phone city state",
    })
        .populate({
        path: "tenant",
        select: "name email profileImage phone city state",
    })
        .lean();
    if (!review) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Review not found");
    }
    return formatReviewItem(review);
});
exports.ReviewService = {
    createReviewIntoDB,
    replyToReviewInDB,
    deleteReplyFromDB,
    getProfessionalReviewsFromDB,
    getProfessionalReviewSummaryFromDB,
    getReviewByBookingIdFromDB,
    getMyReviewsFromDB,
    getSingleReviewFromDB,
};
