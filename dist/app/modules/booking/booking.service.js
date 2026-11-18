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
exports.BookingService = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const http_status_codes_1 = require("http-status-codes");
const config_1 = __importDefault(require("../../../config"));
const ApiErrors_1 = __importDefault(require("../../../errors/ApiErrors"));
const queryBuilder_1 = __importDefault(require("../../builder/queryBuilder"));
const notificationsHelper_1 = require("../../../helpers/notificationsHelper");
const searchHelper_1 = require("../../../helpers/searchHelper");
const stripeHelper_1 = require("../../../helpers/stripeHelper");
const currencyHelper_1 = require("../../../helpers/currencyHelper");
const notification_constant_1 = require("../notification/notification.constant");
const user_1 = require("../../../enums/user");
const jobRequest_1 = require("../../../enums/jobRequest");
const jobRequest_model_1 = require("../jobRequest/jobRequest.model");
const user_model_1 = require("../user/user.model");
const review_model_1 = require("../review/review.model");
const booking_model_1 = require("./booking.model");
const realtime_socket_1 = require("../realtime/realtime.socket");
const quotation_model_1 = require("../quotation/quotation.model");
const quotation_constant_1 = require("../quotation/quotation.constant");
const booking_constant_1 = require("./booking.constant");
const assertValidObjectId = (id, fieldName = "ID") => {
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Invalid ${fieldName}`);
    }
};
const isAdminRole = (role) => role === user_1.USER_ROLES.ADMIN || role === user_1.USER_ROLES.SUPER_ADMIN;
const populateProfessionalRating = (booking) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    let averageRating = 0;
    let totalReviews = 0;
    const proId = ((_a = booking.professional) === null || _a === void 0 ? void 0 : _a._id) || booking.professional;
    if (proId) {
        try {
            const summary = yield review_model_1.Review.calculateAverageRating(proId);
            averageRating = summary.averageRating || 0;
            totalReviews = summary.totalReviews || 0;
        }
        catch (_b) {
            // ignore
        }
    }
    return Object.assign(Object.assign({}, booking), { professional: typeof booking.professional === "object" && booking.professional !== null
            ? Object.assign(Object.assign({}, booking.professional), { averageRating,
                totalReviews }) : booking.professional });
});
const findBookingByIdOrJob = (id) => __awaiter(void 0, void 0, void 0, function* () {
    assertValidObjectId(id, "Booking or Job ID");
    const query = mongoose_1.Types.ObjectId.isValid(id)
        ? {
            $or: [
                { _id: new mongoose_1.Types.ObjectId(id) },
                { jobRequest: new mongoose_1.Types.ObjectId(id) },
            ],
            isDeleted: { $ne: true },
        }
        : { isDeleted: { $ne: true } };
    return yield booking_model_1.Booking.findOne(query);
});
const getMyBookingsFromDB = (userId_1, userRole_1, ...args_1) => __awaiter(void 0, [userId_1, userRole_1, ...args_1], void 0, function* (userId, userRole, query = {}) {
    const normalizedQuery = Object.assign({}, query);
    const baseFilter = {
        isDeleted: { $ne: true },
    };
    if (userRole === user_1.USER_ROLES.HOME_OWNER) {
        baseFilter.homeowner = new mongoose_1.Types.ObjectId(userId);
    }
    else if (userRole === user_1.USER_ROLES.PROFESSIONAL) {
        baseFilter.professional = new mongoose_1.Types.ObjectId(userId);
    }
    // Self-healing sync: Ensure all accepted quotations have corresponding Booking records
    try {
        const userQuoteFilter = {
            status: quotation_constant_1.QUOTATION_STATUS.ACCEPTED,
            isDeleted: { $ne: true },
        };
        if (userRole === user_1.USER_ROLES.HOME_OWNER) {
            userQuoteFilter.homeowner = new mongoose_1.Types.ObjectId(userId);
        }
        else if (userRole === user_1.USER_ROLES.PROFESSIONAL) {
            userQuoteFilter.professional = new mongoose_1.Types.ObjectId(userId);
        }
        const acceptedQuotes = yield quotation_model_1.Quotation.find(userQuoteFilter).lean();
        for (const quote of acceptedQuotes) {
            const existing = yield booking_model_1.Booking.findOne({ quotation: quote._id });
            if (!existing) {
                yield booking_model_1.Booking.create({
                    jobRequest: quote.jobRequest,
                    quotation: quote._id,
                    homeowner: quote.homeowner,
                    professional: quote.professional,
                    totalAmount: quote.totalRate,
                    appointmentDate: quote.appointmentDate ||
                        quote.earliestAvailableDate ||
                        new Date(),
                    arrivalTimeWindow: quote.confirmedArrivalWindow ||
                        quote.arrivalTimeWindow ||
                        "10:00 AM - 12:00 PM",
                    paymentMethod: quote.paymentMethod || "Cash",
                    status: booking_constant_1.BOOKING_STATUS.SCHEDULED,
                });
            }
        }
    }
    catch (_a) {
        // ignore
    }
    // Calculate tab counts
    const [allCount, upcomingCount, activeOnSiteCount, historyCount] = yield Promise.all([
        booking_model_1.Booking.countDocuments(baseFilter),
        booking_model_1.Booking.countDocuments(Object.assign(Object.assign({}, baseFilter), { status: { $in: booking_constant_1.UPCOMING_BOOKING_STATUSES } })),
        booking_model_1.Booking.countDocuments(Object.assign(Object.assign({}, baseFilter), { status: { $in: booking_constant_1.ACTIVE_ON_SITE_STATUSES } })),
        booking_model_1.Booking.countDocuments(Object.assign(Object.assign({}, baseFilter), { status: { $in: booking_constant_1.HISTORY_BOOKING_STATUSES } })),
    ]);
    const tabCounts = {
        all: allCount,
        upcoming: upcomingCount,
        activeOnSite: activeOnSiteCount,
        history: historyCount,
    };
    // Filter by tab if provided (default is 'all' which returns all bookings)
    let activeTab = "all";
    if (normalizedQuery.tab) {
        const tab = String(normalizedQuery.tab).toLowerCase();
        delete normalizedQuery.tab;
        if (tab === "upcoming") {
            baseFilter.status = { $in: booking_constant_1.UPCOMING_BOOKING_STATUSES };
            activeTab = "upcoming";
        }
        else if (tab === "active" ||
            tab === "active_on_site" ||
            tab === "active-on-site") {
            baseFilter.status = { $in: booking_constant_1.ACTIVE_ON_SITE_STATUSES };
            activeTab = "active_on_site";
        }
        else if (tab === "history") {
            baseFilter.status = { $in: booking_constant_1.HISTORY_BOOKING_STATUSES };
            activeTab = "history";
        }
        else {
            activeTab = "all";
        }
    }
    // Enhanced search by client name, contractor name, job headline/title, neighborhood, city
    if (normalizedQuery.searchTerm) {
        const searchTerm = String(normalizedQuery.searchTerm).trim();
        const regex = new RegExp((0, searchHelper_1.escapeRegex)(searchTerm), "i");
        const [matchingUsers, matchingJobs] = yield Promise.all([
            user_model_1.User.find({ name: regex }).select("_id"),
            jobRequest_model_1.JobRequest.find({
                $or: [
                    { headline: regex },
                    { title: regex },
                    { "serviceLocation.city": regex },
                    { "serviceLocation.address": regex },
                    { "serviceLocation.zipCode": regex },
                ],
            }).select("_id"),
        ]);
        const matchingUserIds = matchingUsers.map((u) => u._id);
        const matchingJobIds = matchingJobs.map((j) => j._id);
        baseFilter.$or = [
            { homeowner: { $in: matchingUserIds } },
            { professional: { $in: matchingUserIds } },
            { jobRequest: { $in: matchingJobIds } },
            { arrivalTimeWindow: regex },
            { paymentMethod: regex },
        ];
        delete normalizedQuery.searchTerm;
    }
    const queryBuilder = new queryBuilder_1.default(booking_model_1.Booking.find(baseFilter)
        .populate({
        path: "jobRequest",
        select: "headline title description projectPhotos timeframe serviceLocation propertyType estimatedBudget status",
        populate: { path: "category", select: "name icon coverImage" },
    })
        .populate({
        path: "quotation",
        select: "priceType totalRate scopeOfWork exclusions partsAndMaterialsIncluded estimatedDuration arrivalTimeWindow warranty additionalNotes status",
    })
        .populate("homeowner", "name email profileImage phone city state zipCode streetAddress")
        .populate({
        path: "professional",
        select: "name email profileImage phone verified city state companyName about category",
        populate: { path: "category", select: "name icon" },
    }), normalizedQuery)
        .search(booking_constant_1.bookingSearchableFields)
        .filter()
        .sort();
    queryBuilder.paginate();
    const [data, meta] = yield Promise.all([
        queryBuilder.modelQuery.lean(),
        queryBuilder.countTotal(),
    ]);
    // Batch load reviews for bookings
    const bookingIds = data.map((b) => b._id);
    const jobRequestIds = data
        .map((b) => { var _a; return (((_a = b.jobRequest) === null || _a === void 0 ? void 0 : _a._id) ? b.jobRequest._id : b.jobRequest); })
        .filter(Boolean);
    const reviews = yield review_model_1.Review.find({
        $or: [
            { booking: { $in: bookingIds } },
            { maintenance: { $in: [...bookingIds, ...jobRequestIds] } },
            { jobRequest: { $in: jobRequestIds } },
        ],
    })
        .populate({
        path: "tenant",
        select: "name profileImage city state",
    })
        .populate({
        path: "homeowner",
        select: "name profileImage city state",
    })
        .lean();
    const reviewMap = new Map();
    reviews.forEach((r) => {
        const homeownerUser = r.homeowner || r.tenant;
        const professionalUser = r.professional || r.contractor;
        delete r.tenant;
        delete r.contractor;
        delete r.maintenance;
        const formatted = Object.assign(Object.assign({}, r), { homeowner: homeownerUser, professional: professionalUser, isReplied: Boolean(r.isReplied || (r.reply && r.reply.trim().length > 0)) });
        if (r.booking)
            reviewMap.set(r.booking.toString(), formatted);
        if (r.maintenance)
            reviewMap.set(r.maintenance.toString(), formatted);
        if (r.jobRequest)
            reviewMap.set(r.jobRequest.toString(), formatted);
    });
    const enrichedData = yield Promise.all(data.map((b) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        const ratedBooking = yield populateProfessionalRating(b);
        const bookingReview = reviewMap.get(b._id.toString()) ||
            (((_a = b.jobRequest) === null || _a === void 0 ? void 0 : _a._id) && reviewMap.get(b.jobRequest._id.toString())) ||
            null;
        return Object.assign(Object.assign({}, ratedBooking), { review: bookingReview, hasReviewed: Boolean(bookingReview) });
    })));
    return { data: enrichedData, meta, tabCounts, activeTab };
});
const getBookingByIdFromDB = (id, userId, userRole) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g;
    assertValidObjectId(id, "Booking or Job ID");
    const booking = yield booking_model_1.Booking.findOne({
        $or: [
            { _id: new mongoose_1.Types.ObjectId(id) },
            { jobRequest: new mongoose_1.Types.ObjectId(id) },
        ],
        isDeleted: { $ne: true },
    })
        .populate({
        path: "jobRequest",
        populate: [
            { path: "category", select: "name icon coverImage" },
            { path: "homeowner", select: "name email profileImage phone" },
        ],
    })
        .populate({
        path: "quotation",
    })
        .populate("homeowner", "name email profileImage phone city state zipCode streetAddress")
        .populate({
        path: "professional",
        select: "name email profileImage phone verified city state companyName about yearsOfExperience startingRate hourlyRate category tradeLicense liabilityInsurance",
        populate: { path: "category", select: "name icon" },
    })
        .lean();
    if (!booking) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Booking not found");
    }
    const homeownerId = ((_b = (_a = booking.homeowner) === null || _a === void 0 ? void 0 : _a._id) === null || _b === void 0 ? void 0 : _b.toString()) ||
        ((_c = booking.homeowner) === null || _c === void 0 ? void 0 : _c.toString());
    const proId = ((_e = (_d = booking.professional) === null || _d === void 0 ? void 0 : _d._id) === null || _e === void 0 ? void 0 : _e.toString()) ||
        ((_f = booking.professional) === null || _f === void 0 ? void 0 : _f.toString());
    const isOwner = homeownerId === userId;
    const isPro = proId === userId;
    const isAdmin = isAdminRole(userRole);
    if (!isOwner && !isPro && !isAdmin) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "You do not have permission to view this booking");
    }
    const enriched = yield populateProfessionalRating(booking);
    // Look up review for this booking or job
    const jobRequestId = ((_g = booking.jobRequest) === null || _g === void 0 ? void 0 : _g._id) || booking.jobRequest;
    const reviewDoc = yield review_model_1.Review.findOne({
        $or: [
            { booking: booking._id },
            { maintenance: booking._id },
            ...(jobRequestId
                ? [{ maintenance: jobRequestId }, { jobRequest: jobRequestId }]
                : []),
        ],
    })
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
    })
        .lean();
    let review = null;
    if (reviewDoc) {
        const homeownerUser = reviewDoc.homeowner || reviewDoc.tenant;
        const professionalUser = reviewDoc.professional || reviewDoc.contractor;
        delete reviewDoc.tenant;
        delete reviewDoc.contractor;
        delete reviewDoc.maintenance;
        review = Object.assign(Object.assign({}, reviewDoc), { homeowner: homeownerUser, professional: professionalUser, isReplied: Boolean(reviewDoc.isReplied ||
                (reviewDoc.reply && reviewDoc.reply.trim().length > 0)) });
    }
    // Compute UI helper permissions
    const isUpcoming = booking_constant_1.UPCOMING_BOOKING_STATUSES.includes(booking.status);
    const isActiveOnSite = booking_constant_1.ACTIVE_ON_SITE_STATUSES.includes(booking.status);
    const permissions = {
        canReschedule: isOwner && isUpcoming,
        canCancel: isOwner && isUpcoming,
        canStartWork: isPro &&
            (booking.status === booking_constant_1.BOOKING_STATUS.SCHEDULED ||
                booking.status === booking_constant_1.BOOKING_STATUS.ON_THE_WAY),
        canGoOnTheWay: isPro && booking.status === booking_constant_1.BOOKING_STATUS.SCHEDULED,
        canMarkComplete: isPro &&
            (booking.status === booking_constant_1.BOOKING_STATUS.IN_PROGRESS ||
                booking.status === booking_constant_1.BOOKING_STATUS.ON_THE_WAY),
        canConfirmCompletion: isOwner && booking.status === booking_constant_1.BOOKING_STATUS.PENDING_COMPLETION,
        canReview: isOwner && booking.status === booking_constant_1.BOOKING_STATUS.COMPLETED && !review,
        isUpcoming,
        isActiveOnSite,
    };
    return Object.assign(Object.assign({}, enriched), { review, hasReviewed: Boolean(review), permissions });
});
const rescheduleBookingToDB = (id, userId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const booking = yield findBookingByIdOrJob(id);
    if (!booking) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Booking not found");
    }
    if (booking.homeowner.toString() !== userId) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "Only the homeowner can reschedule this booking");
    }
    // Active on-site check
    if (booking_constant_1.ACTIVE_ON_SITE_STATUSES.includes(booking.status)) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Cannot reschedule a booking that is active on-site.");
    }
    if (booking_constant_1.HISTORY_BOOKING_STATUSES.includes(booking.status)) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Cannot reschedule a completed or cancelled booking.");
    }
    // Record history
    booking.rescheduleHistory = booking.rescheduleHistory || [];
    booking.rescheduleHistory.push({
        appointmentDate: booking.appointmentDate,
        arrivalTimeWindow: booking.arrivalTimeWindow,
        paymentMethod: booking.paymentMethod,
        rescheduledAt: new Date(),
    });
    booking.appointmentDate = new Date(payload.appointmentDate);
    booking.arrivalTimeWindow = payload.arrivalTimeWindow;
    if (payload.paymentMethod) {
        booking.paymentMethod = payload.paymentMethod;
    }
    booking.rescheduledAt = new Date();
    yield booking.save();
    realtime_socket_1.realtimeSocket.booking({
        bookingId: booking._id,
        jobRequestId: booking.jobRequest,
        homeownerId: booking.homeowner,
        professionalId: booking.professional,
        action: "rescheduled",
        status: booking.status,
    });
    // Notify professional
    try {
        const jobRequest = yield jobRequest_model_1.JobRequest.findById(booking.jobRequest);
        yield (0, notificationsHelper_1.sendNotifications)({
            receiver: booking.professional,
            sender: new mongoose_1.Types.ObjectId(userId),
            title: "Appointment Rescheduled",
            text: `Homeowner rescheduled appointment for "${(jobRequest === null || jobRequest === void 0 ? void 0 : jobRequest.headline) || "service"}" to ${new Date(payload.appointmentDate).toLocaleDateString()} (${payload.arrivalTimeWindow}).`,
            type: notification_constant_1.NOTIFICATION_TYPE.PROFESSIONAL,
            referenceId: booking._id,
            referenceModel: "Booking",
        });
    }
    catch (_a) {
        // ignore
    }
    return yield getBookingByIdFromDB(booking._id.toString(), userId);
});
const cancelBookingToDB = (id, userId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const booking = yield findBookingByIdOrJob(id);
    if (!booking) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Booking not found");
    }
    if (booking.homeowner.toString() !== userId) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "Only the homeowner can cancel this booking");
    }
    // Active on-site check
    if (booking_constant_1.ACTIVE_ON_SITE_STATUSES.includes(booking.status)) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Cannot cancel a booking that is active on-site.");
    }
    if (booking_constant_1.HISTORY_BOOKING_STATUSES.includes(booking.status)) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Booking is already completed or cancelled.");
    }
    booking.status = booking_constant_1.BOOKING_STATUS.CANCELLED;
    booking.cancelledAt = new Date();
    booking.cancelledBy = new mongoose_1.Types.ObjectId(userId);
    if (payload === null || payload === void 0 ? void 0 : payload.reason) {
        booking.cancellationReason = payload.reason;
    }
    yield booking.save();
    realtime_socket_1.realtimeSocket.booking({
        bookingId: booking._id,
        jobRequestId: booking.jobRequest,
        homeownerId: booking.homeowner,
        professionalId: booking.professional,
        action: "cancelled",
        status: booking.status,
        broadcastProfessionals: true,
    });
    yield jobRequest_model_1.JobRequest.findByIdAndUpdate(booking.jobRequest, {
        status: jobRequest_1.JOB_REQUEST_STATUS.CANCELLED,
    });
    // Notify professional
    try {
        const jobRequest = yield jobRequest_model_1.JobRequest.findById(booking.jobRequest);
        yield (0, notificationsHelper_1.sendNotifications)({
            receiver: booking.professional,
            sender: new mongoose_1.Types.ObjectId(userId),
            title: "Booking Cancelled",
            text: `Homeowner has cancelled the booking for "${(jobRequest === null || jobRequest === void 0 ? void 0 : jobRequest.headline) || "service"}". Reason: ${(payload === null || payload === void 0 ? void 0 : payload.reason) || "Not specified"}`,
            type: notification_constant_1.NOTIFICATION_TYPE.PROFESSIONAL,
            referenceId: booking._id,
            referenceModel: "Booking",
        });
    }
    catch (_a) {
        // ignore
    }
    return yield getBookingByIdFromDB(booking._id.toString(), userId);
});
// Professional: On the way (En Route)
const onTheWayToDB = (id, proId) => __awaiter(void 0, void 0, void 0, function* () {
    const booking = yield findBookingByIdOrJob(id);
    if (!booking) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Booking not found");
    }
    if (booking.professional.toString() !== proId) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "Only the assigned professional can update travel status");
    }
    if (booking_constant_1.HISTORY_BOOKING_STATUSES.includes(booking.status)) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Cannot update a completed or cancelled booking");
    }
    booking.status = booking_constant_1.BOOKING_STATUS.ON_THE_WAY;
    booking.onTheWayAt = new Date();
    yield booking.save();
    realtime_socket_1.realtimeSocket.booking({
        bookingId: booking._id,
        jobRequestId: booking.jobRequest,
        homeownerId: booking.homeowner,
        professionalId: booking.professional,
        action: "on_the_way",
        status: booking.status,
    });
    // Notify homeowner
    try {
        const jobRequest = yield jobRequest_model_1.JobRequest.findById(booking.jobRequest);
        yield (0, notificationsHelper_1.sendNotifications)({
            receiver: booking.homeowner,
            sender: new mongoose_1.Types.ObjectId(proId),
            title: "Contractor On The Way",
            text: `Your contractor is on the way for "${(jobRequest === null || jobRequest === void 0 ? void 0 : jobRequest.headline) || "service"}".`,
            type: notification_constant_1.NOTIFICATION_TYPE.HOME_OWNER,
            referenceId: booking._id,
            referenceModel: "Booking",
        });
    }
    catch (_a) {
        // ignore
    }
    return yield getBookingByIdFromDB(booking._id.toString(), proId);
});
// Professional: Start work directly
const startWorkToDB = (id, proId) => __awaiter(void 0, void 0, void 0, function* () {
    const booking = yield findBookingByIdOrJob(id);
    if (!booking) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Booking not found");
    }
    if (booking.professional.toString() !== proId) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "Only the assigned professional can start work");
    }
    if (booking_constant_1.HISTORY_BOOKING_STATUSES.includes(booking.status)) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Cannot start work on a completed or cancelled booking");
    }
    booking.status = booking_constant_1.BOOKING_STATUS.IN_PROGRESS;
    booking.workStartedAt = new Date();
    yield booking.save();
    realtime_socket_1.realtimeSocket.booking({
        bookingId: booking._id,
        jobRequestId: booking.jobRequest,
        homeownerId: booking.homeowner,
        professionalId: booking.professional,
        action: "started",
        status: booking.status,
    });
    yield jobRequest_model_1.JobRequest.findByIdAndUpdate(booking.jobRequest, {
        status: jobRequest_1.JOB_REQUEST_STATUS.IN_PROGRESS,
    });
    // Notify homeowner
    try {
        const jobRequest = yield jobRequest_model_1.JobRequest.findById(booking.jobRequest);
        yield (0, notificationsHelper_1.sendNotifications)({
            receiver: booking.homeowner,
            sender: new mongoose_1.Types.ObjectId(proId),
            title: "Work Started On-Site",
            text: `Contractor has arrived on site and started work on "${(jobRequest === null || jobRequest === void 0 ? void 0 : jobRequest.headline) || "service"}".`,
            type: notification_constant_1.NOTIFICATION_TYPE.HOME_OWNER,
            referenceId: booking._id,
            referenceModel: "Booking",
        });
    }
    catch (_a) {
        // ignore
    }
    return yield getBookingByIdFromDB(booking._id.toString(), proId);
});
// Professional: Mark work complete
const completeWorkToDB = (id, proId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const booking = yield findBookingByIdOrJob(id);
    if (!booking) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Booking not found");
    }
    if (booking.professional.toString() !== proId) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "Only the assigned professional can mark work complete");
    }
    // Work MUST be started before marking complete
    if (booking.status !== booking_constant_1.BOOKING_STATUS.IN_PROGRESS &&
        booking.status !== booking_constant_1.BOOKING_STATUS.ON_THE_WAY) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "You must start work on site before marking it as complete.");
    }
    booking.status = booking_constant_1.BOOKING_STATUS.PENDING_COMPLETION;
    booking.contractorCompletedAt = new Date();
    if (payload === null || payload === void 0 ? void 0 : payload.completionNote) {
        booking.contractorCompletionNote = payload.completionNote;
    }
    yield booking.save();
    realtime_socket_1.realtimeSocket.booking({
        bookingId: booking._id,
        jobRequestId: booking.jobRequest,
        homeownerId: booking.homeowner,
        professionalId: booking.professional,
        action: "work_completed",
        status: booking.status,
    });
    // Notify homeowner to inspect and confirm
    try {
        const jobRequest = yield jobRequest_model_1.JobRequest.findById(booking.jobRequest);
        yield (0, notificationsHelper_1.sendNotifications)({
            receiver: booking.homeowner,
            sender: new mongoose_1.Types.ObjectId(proId),
            title: "Contractor Marked Work Completed",
            text: `Contractor has marked work completed on "${(jobRequest === null || jobRequest === void 0 ? void 0 : jobRequest.headline) || "service"}". Please inspect the work and confirm satisfaction.`,
            type: notification_constant_1.NOTIFICATION_TYPE.HOME_OWNER,
            referenceId: booking._id,
            referenceModel: "Booking",
        });
    }
    catch (_a) {
        // ignore
    }
    return yield getBookingByIdFromDB(booking._id.toString(), proId);
});
// Homeowner: Confirm Work Completion & Payment
const confirmCompletionToDB = (id, userId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const booking = yield findBookingByIdOrJob(id);
    if (!booking) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Booking not found");
    }
    if (booking.homeowner.toString() !== userId) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "Only the homeowner can confirm work completion");
    }
    // Already completed & paid check
    if (booking.status === booking_constant_1.BOOKING_STATUS.COMPLETED &&
        booking.paymentStatus === booking_constant_1.BOOKING_PAYMENT_STATUS.PAID) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "This booking is already completed and paid.");
    }
    // Status must be pending completion (contractor completed work)
    if (booking.status !== booking_constant_1.BOOKING_STATUS.PENDING_COMPLETION) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Contractor has not marked work as completed yet.");
    }
    const selectedMethod = payload.paymentMethod
        ? (0, booking_constant_1.normalizePaymentMethod)(payload.paymentMethod)
        : booking.paymentMethod
            ? (0, booking_constant_1.normalizePaymentMethod)(booking.paymentMethod)
            : booking_constant_1.BOOKING_PAYMENT_METHOD.CASH;
    // If Stripe online payment is selected
    if (selectedMethod === booking_constant_1.BOOKING_PAYMENT_METHOD.STRIPE) {
        const [homeowner, jobRequest] = yield Promise.all([
            user_model_1.User.findById(userId),
            jobRequest_model_1.JobRequest.findById(booking.jobRequest),
        ]);
        const amount = Math.max(0, Number(booking.totalAmount) || 0);
        if (amount <= 0) {
            throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Total amount must be greater than zero for online payment");
        }
        const stripe = (0, stripeHelper_1.getStripe)();
        const clientUrl = config_1.default.client_url || "http://localhost:3000";
        const currency = (0, currencyHelper_1.getCurrencyCode)();
        const session = yield stripe.checkout.sessions.create({
            allowed_payment_method_types: ["card"],
            mode: "payment",
            customer_email: (homeowner === null || homeowner === void 0 ? void 0 : homeowner.email) || undefined,
            line_items: [
                {
                    price_data: {
                        currency,
                        product_data: {
                            name: `LocalFix Service: ${(jobRequest === null || jobRequest === void 0 ? void 0 : jobRequest.headline) || "Home Service"}`,
                            description: `Payment for booking #${booking._id}`,
                        },
                        unit_amount: Math.round(amount * 100),
                    },
                    quantity: 1,
                },
            ],
            success_url: `${clientUrl}/bookings/${booking._id}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${clientUrl}/bookings/${booking._id}?payment=cancelled`,
            metadata: {
                paymentType: "booking_payment",
                bookingId: booking._id.toString(),
                homeownerId: booking.homeowner.toString(),
                professionalId: booking.professional.toString(),
                jobRequestId: booking.jobRequest.toString(),
                paymentMethod: booking_constant_1.BOOKING_PAYMENT_METHOD.STRIPE,
                isSatisfactionConfirmed: String(payload.isSatisfactionConfirmed !== false),
                isPaidDirectly: String(Boolean(payload.isPaidDirectly)),
            },
        });
        // Update booking with pending Stripe session info.
        // Notice: status remains PENDING_COMPLETION until webhook verifies payment!
        booking.settledPaymentMethod = booking_constant_1.BOOKING_PAYMENT_METHOD.STRIPE;
        booking.paymentStatus = booking_constant_1.BOOKING_PAYMENT_STATUS.PENDING;
        booking.stripeSessionId = session.id;
        booking.stripePaymentUrl = session.url;
        booking.isSatisfactionConfirmed =
            payload.isSatisfactionConfirmed !== false;
        booking.isPaidDirectly = Boolean(payload.isPaidDirectly);
        yield booking.save();
        const bookingData = yield getBookingByIdFromDB(booking._id.toString(), userId);
        return Object.assign(Object.assign({ requiresPayment: true, paymentMethod: booking_constant_1.BOOKING_PAYMENT_METHOD.STRIPE, paymentUrl: session.url, checkoutUrl: session.url, sessionId: session.id }, bookingData), { booking: bookingData });
    }
    // Manual payment methods (Cash, Bank Transfer, Check, Card, etc.)
    booking.status = booking_constant_1.BOOKING_STATUS.COMPLETED;
    booking.paymentStatus = booking_constant_1.BOOKING_PAYMENT_STATUS.PAID;
    booking.homeownerCompletedAt = new Date();
    booking.paidAt = new Date();
    booking.settledPaymentMethod = selectedMethod;
    booking.isPaidDirectly = payload.isPaidDirectly !== false;
    booking.isSatisfactionConfirmed = payload.isSatisfactionConfirmed !== false;
    yield booking.save();
    realtime_socket_1.realtimeSocket.booking({
        bookingId: booking._id,
        jobRequestId: booking.jobRequest,
        homeownerId: booking.homeowner,
        professionalId: booking.professional,
        action: "completed",
        status: booking.status,
    });
    // Update JobRequest to completed
    yield jobRequest_model_1.JobRequest.findByIdAndUpdate(booking.jobRequest, {
        status: jobRequest_1.JOB_REQUEST_STATUS.COMPLETED,
    });
    // Increment completedJobs on professional user
    yield user_model_1.User.findByIdAndUpdate(booking.professional, {
        $inc: { completedJobs: 1 },
    });
    // Notify professional
    try {
        const jobRequest = yield jobRequest_model_1.JobRequest.findById(booking.jobRequest);
        yield (0, notificationsHelper_1.sendNotifications)({
            receiver: booking.professional,
            sender: new mongoose_1.Types.ObjectId(userId),
            title: "Work Completion Confirmed!",
            text: `Homeowner has confirmed completion and payment (${selectedMethod}) for "${(jobRequest === null || jobRequest === void 0 ? void 0 : jobRequest.headline) || "service"}".`,
            type: notification_constant_1.NOTIFICATION_TYPE.PROFESSIONAL,
            referenceId: booking._id,
            referenceModel: "Booking",
        });
    }
    catch (_a) {
        // ignore
    }
    const bookingData = yield getBookingByIdFromDB(booking._id.toString(), userId);
    return Object.assign(Object.assign({ requiresPayment: false, paymentMethod: selectedMethod, paymentUrl: null, checkoutUrl: null, sessionId: null }, bookingData), { booking: bookingData });
});
// Webhook handler for Stripe Checkout Session Completion
const handleBookingPaymentCompleted = (session) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    const bookingId = ((_a = session.metadata) === null || _a === void 0 ? void 0 : _a.bookingId) || session.client_reference_id;
    if (!bookingId) {
        return;
    }
    const booking = yield booking_model_1.Booking.findById(bookingId);
    if (!booking) {
        return;
    }
    // Idempotency: if already completed and marked paid, skip
    if (booking.status === booking_constant_1.BOOKING_STATUS.COMPLETED &&
        booking.paymentStatus === booking_constant_1.BOOKING_PAYMENT_STATUS.PAID) {
        return;
    }
    booking.status = booking_constant_1.BOOKING_STATUS.COMPLETED;
    booking.paymentStatus = booking_constant_1.BOOKING_PAYMENT_STATUS.PAID;
    booking.homeownerCompletedAt = new Date();
    booking.paidAt = new Date();
    booking.settledPaymentMethod = booking_constant_1.BOOKING_PAYMENT_METHOD.STRIPE;
    booking.stripeSessionId = session.id;
    if (session.payment_intent) {
        booking.stripePaymentIntentId =
            typeof session.payment_intent === "string"
                ? session.payment_intent
                : session.payment_intent.id;
    }
    booking.isPaidDirectly = ((_b = session.metadata) === null || _b === void 0 ? void 0 : _b.isPaidDirectly) === "true";
    booking.isSatisfactionConfirmed =
        ((_c = session.metadata) === null || _c === void 0 ? void 0 : _c.isSatisfactionConfirmed) !== "false";
    yield booking.save();
    realtime_socket_1.realtimeSocket.booking({
        bookingId: booking._id,
        jobRequestId: booking.jobRequest,
        homeownerId: booking.homeowner,
        professionalId: booking.professional,
        action: "paid",
        status: booking.status,
    });
    // Update JobRequest to completed
    yield jobRequest_model_1.JobRequest.findByIdAndUpdate(booking.jobRequest, {
        status: jobRequest_1.JOB_REQUEST_STATUS.COMPLETED,
    });
    // Increment completedJobs on professional user
    yield user_model_1.User.findByIdAndUpdate(booking.professional, {
        $inc: { completedJobs: 1 },
    });
    // Notify professional and homeowner
    try {
        const jobRequest = yield jobRequest_model_1.JobRequest.findById(booking.jobRequest);
        const amountStr = session.amount_total
            ? `${(session.amount_total / 100).toFixed(2)} ${((_d = session.currency) === null || _d === void 0 ? void 0 : _d.toUpperCase()) || ""}`
            : `${booking.totalAmount}`;
        yield (0, notificationsHelper_1.sendNotifications)({
            receiver: booking.professional,
            sender: booking.homeowner,
            title: "Work Completion & Payment Confirmed!",
            text: `Homeowner has completed payment of ${amountStr} via Stripe for "${(jobRequest === null || jobRequest === void 0 ? void 0 : jobRequest.headline) || "service"}".`,
            type: notification_constant_1.NOTIFICATION_TYPE.PROFESSIONAL,
            referenceId: booking._id,
            referenceModel: "Booking",
        });
        yield (0, notificationsHelper_1.sendNotifications)({
            receiver: booking.homeowner,
            sender: booking.professional,
            title: "Payment Successful",
            text: `Your payment of ${amountStr} for "${(jobRequest === null || jobRequest === void 0 ? void 0 : jobRequest.headline) || "service"}" was successful. Thank you!`,
            type: notification_constant_1.NOTIFICATION_TYPE.HOME_OWNER,
            referenceId: booking._id,
            referenceModel: "Booking",
        });
    }
    catch (_e) {
        // ignore
    }
});
// Webhook handler for Stripe PaymentIntent Succeeded
const handlePaymentIntentSucceeded = (paymentIntent) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const bookingId = (_a = paymentIntent.metadata) === null || _a === void 0 ? void 0 : _a.bookingId;
    if (!bookingId) {
        return;
    }
    const booking = yield booking_model_1.Booking.findById(bookingId);
    if (!booking)
        return;
    if (booking.status === booking_constant_1.BOOKING_STATUS.COMPLETED &&
        booking.paymentStatus === booking_constant_1.BOOKING_PAYMENT_STATUS.PAID) {
        return;
    }
    booking.status = booking_constant_1.BOOKING_STATUS.COMPLETED;
    booking.paymentStatus = booking_constant_1.BOOKING_PAYMENT_STATUS.PAID;
    booking.homeownerCompletedAt = new Date();
    booking.paidAt = new Date();
    booking.settledPaymentMethod = booking_constant_1.BOOKING_PAYMENT_METHOD.STRIPE;
    booking.stripePaymentIntentId = paymentIntent.id;
    yield booking.save();
    realtime_socket_1.realtimeSocket.booking({
        bookingId: booking._id,
        jobRequestId: booking.jobRequest,
        homeownerId: booking.homeowner,
        professionalId: booking.professional,
        action: "paid",
        status: booking.status,
    });
    yield jobRequest_model_1.JobRequest.findByIdAndUpdate(booking.jobRequest, {
        status: jobRequest_1.JOB_REQUEST_STATUS.COMPLETED,
    });
    yield user_model_1.User.findByIdAndUpdate(booking.professional, {
        $inc: { completedJobs: 1 },
    });
});
// Homeowner/Professional: Verify Payment Status with Stripe (Sync / Fallback)
const verifyBookingPaymentToDB = (id, userId) => __awaiter(void 0, void 0, void 0, function* () {
    const booking = yield findBookingByIdOrJob(id);
    if (!booking) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Booking not found");
    }
    const homeownerId = booking.homeowner.toString();
    const proId = booking.professional.toString();
    if (homeownerId !== userId && proId !== userId) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "Access denied");
    }
    // If already completed & paid, return latest state
    if (booking.status === booking_constant_1.BOOKING_STATUS.COMPLETED &&
        booking.paymentStatus === booking_constant_1.BOOKING_PAYMENT_STATUS.PAID) {
        return yield getBookingByIdFromDB(booking._id.toString(), userId);
    }
    // If Stripe session exists and status is still pending, verify with Stripe
    if (booking.stripeSessionId) {
        try {
            const stripe = (0, stripeHelper_1.getStripe)();
            const session = yield stripe.checkout.sessions.retrieve(booking.stripeSessionId);
            if (session.payment_status === "paid") {
                yield handleBookingPaymentCompleted(session);
            }
        }
        catch (_a) {
            // ignore
        }
    }
    return yield getBookingByIdFromDB(booking._id.toString(), userId);
});
exports.BookingService = {
    getMyBookingsFromDB,
    getBookingByIdFromDB,
    rescheduleBookingToDB,
    cancelBookingToDB,
    onTheWayToDB,
    startWorkToDB,
    completeWorkToDB,
    confirmCompletionToDB,
    handleBookingPaymentCompleted,
    handlePaymentIntentSucceeded,
    verifyBookingPaymentToDB,
};
