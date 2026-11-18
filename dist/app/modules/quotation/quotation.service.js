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
exports.QuotationService = void 0;
const mongoose_1 = require("mongoose");
const http_status_codes_1 = require("http-status-codes");
const ApiErrors_1 = __importDefault(require("../../../errors/ApiErrors"));
const queryBuilder_1 = __importDefault(require("../../builder/queryBuilder"));
const notificationsHelper_1 = require("../../../helpers/notificationsHelper");
const notification_constant_1 = require("../notification/notification.constant");
const user_1 = require("../../../enums/user");
const jobRequest_1 = require("../../../enums/jobRequest");
const jobRequest_model_1 = require("../jobRequest/jobRequest.model");
const user_model_1 = require("../user/user.model");
const review_model_1 = require("../review/review.model");
const quotation_model_1 = require("./quotation.model");
const booking_model_1 = require("../booking/booking.model");
const realtime_socket_1 = require("../realtime/realtime.socket");
const booking_constant_1 = require("../booking/booking.constant");
const quotation_constant_1 = require("./quotation.constant");
const subscription_helper_1 = require("../subscription/subscription.helper");
const assertValidObjectId = (id, fieldName = "ID") => {
    if (!mongoose_1.Types.ObjectId.isValid(id)) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Invalid ${fieldName}`);
    }
};
const isAdminRole = (role) => role === user_1.USER_ROLES.ADMIN || role === user_1.USER_ROLES.SUPER_ADMIN;
const populateProfessionalRating = (quote) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    let averageRating = 0;
    let totalReviews = 0;
    const proId = ((_a = quote.professional) === null || _a === void 0 ? void 0 : _a._id) || quote.professional;
    if (proId) {
        try {
            const summary = yield review_model_1.Review.calculateAverageRating(proId);
            averageRating = summary.averageRating || 0;
            totalReviews = summary.totalReviews || 0;
        }
        catch (_b) {
            // ignore calculation errors
        }
    }
    const isExpired = Boolean(quote.offerValidUntil && new Date() > new Date(quote.offerValidUntil));
    let currentStatus = quote.status;
    if (quote.status === quotation_constant_1.QUOTATION_STATUS.PENDING && isExpired) {
        currentStatus = quotation_constant_1.QUOTATION_STATUS.EXPIRED;
        // update status in DB if not already updated
        quotation_model_1.Quotation.updateOne({ _id: quote._id, status: quotation_constant_1.QUOTATION_STATUS.PENDING }, { status: quotation_constant_1.QUOTATION_STATUS.EXPIRED }).exec();
    }
    return Object.assign(Object.assign({}, quote), { status: currentStatus, isExpired, professional: typeof quote.professional === "object" && quote.professional !== null
            ? Object.assign(Object.assign({}, quote.professional), { averageRating,
                totalReviews }) : quote.professional });
});
const createQuotationToDB = (proId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    assertValidObjectId(payload.jobRequest, "Job Request ID");
    const jobRequest = yield jobRequest_model_1.JobRequest.findById(payload.jobRequest);
    if (!jobRequest || jobRequest.isDeleted) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Job request not found");
    }
    // Prevent sending quotes to closed, cancelled, or in-progress jobs
    if (jobRequest.status === jobRequest_1.JOB_REQUEST_STATUS.COMPLETED ||
        jobRequest.status === jobRequest_1.JOB_REQUEST_STATUS.CANCELLED ||
        jobRequest.status === jobRequest_1.JOB_REQUEST_STATUS.IN_PROGRESS) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "This job request is no longer accepting quotations");
    }
    // If this was a direct request targeted to a specific pro, ensure caller is that pro
    if (jobRequest.professional && jobRequest.professional.toString() !== proId) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "This is a direct job request assigned to another professional");
    }
    // Ensure pro has not already rejected this request
    const rejectedBy = (jobRequest.rejectedBy || []).map((u) => u.toString());
    if (rejectedBy.includes(proId)) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "You have already rejected this job request");
    }
    // Check if pro already submitted an active quote for this job
    const existingActiveQuote = yield quotation_model_1.Quotation.findOne({
        jobRequest: jobRequest._id,
        professional: new mongoose_1.Types.ObjectId(proId),
        status: { $in: [quotation_constant_1.QUOTATION_STATUS.PENDING, quotation_constant_1.QUOTATION_STATUS.ACCEPTED] },
        isDeleted: { $ne: true },
    });
    if (existingActiveQuote) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.CONFLICT, "You have already submitted an active quotation for this job request");
    }
    const proUser = yield user_model_1.User.findById(proId);
    if (!proUser || proUser.role !== user_1.USER_ROLES.PROFESSIONAL) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "Only professionals can send quotations");
    }
    // Subscription package and quotation limit guard
    yield (0, subscription_helper_1.verifyQuotationSubscriptionGuard)(proId);
    const quotationData = Object.assign(Object.assign({}, payload), { jobRequest: jobRequest._id, professional: new mongoose_1.Types.ObjectId(proId), homeowner: jobRequest.homeowner, status: quotation_constant_1.QUOTATION_STATUS.PENDING, isHired: false });
    const createdQuotation = yield quotation_model_1.Quotation.create(quotationData);
    // Recalculate quotesCount for this jobRequest
    const totalQuotes = yield quotation_model_1.Quotation.countDocuments({
        jobRequest: jobRequest._id,
        isDeleted: { $ne: true },
    });
    yield jobRequest_model_1.JobRequest.findByIdAndUpdate(jobRequest._id, Object.assign({ quotesCount: totalQuotes }, (jobRequest.status === jobRequest_1.JOB_REQUEST_STATUS.AWAITING_QUOTES
        ? { status: jobRequest_1.JOB_REQUEST_STATUS.QUOTED }
        : {})));
    // Notify homeowner
    try {
        yield (0, notificationsHelper_1.sendNotifications)({
            receiver: jobRequest.homeowner,
            sender: new mongoose_1.Types.ObjectId(proId),
            title: "New Quotation Received",
            text: `${proUser.name || "A professional"} sent you a quotation of $${payload.totalRate} for "${jobRequest.headline || jobRequest.title}"`,
            type: notification_constant_1.NOTIFICATION_TYPE.HOME_OWNER,
            referenceId: createdQuotation._id,
            referenceModel: "Quotation",
        });
    }
    catch (_a) {
        // notification failure should not block creation
    }
    realtime_socket_1.realtimeSocket.quote({
        quotationId: createdQuotation._id,
        jobRequestId: jobRequest._id,
        homeownerId: jobRequest.homeowner,
        professionalId: proId,
        action: "created",
        status: createdQuotation.status,
        broadcastProfessionals: true,
    });
    const populated = yield quotation_model_1.Quotation.findById(createdQuotation._id)
        .populate({
        path: "jobRequest",
        select: "headline title description timeframe serviceLocation propertyType estimatedBudget status",
        populate: { path: "category", select: "name icon coverImage" },
    })
        .populate("homeowner", "name email profileImage phone")
        .populate({
        path: "professional",
        select: "name email profileImage phone verified city state companyName about yearsOfExperience startingRate hourlyRate category",
        populate: { path: "category", select: "name icon" },
    })
        .lean();
    return yield populateProfessionalRating(populated);
});
const getQuotationByIdFromDB = (id, userId, userRole) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    assertValidObjectId(id, "Quotation ID");
    const quotation = yield quotation_model_1.Quotation.findById(id)
        .populate({
        path: "jobRequest",
        populate: [
            { path: "category", select: "name icon coverImage" },
            { path: "homeowner", select: "name email profileImage phone" },
        ],
    })
        .populate("homeowner", "name email profileImage phone city state zipCode streetAddress")
        .populate({
        path: "professional",
        select: "name email profileImage phone verified city state companyName about yearsOfExperience startingRate hourlyRate category tradeLicense liabilityInsurance",
        populate: { path: "category", select: "name icon" },
    })
        .lean();
    if (!quotation || quotation.isDeleted) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Quotation not found");
    }
    const homeownerId = ((_b = (_a = quotation.homeowner) === null || _a === void 0 ? void 0 : _a._id) === null || _b === void 0 ? void 0 : _b.toString()) ||
        ((_c = quotation.homeowner) === null || _c === void 0 ? void 0 : _c.toString());
    const proId = ((_e = (_d = quotation.professional) === null || _d === void 0 ? void 0 : _d._id) === null || _e === void 0 ? void 0 : _e.toString()) ||
        ((_f = quotation.professional) === null || _f === void 0 ? void 0 : _f.toString());
    const isOwner = homeownerId === userId;
    const isPro = proId === userId;
    const isAdmin = isAdminRole(userRole);
    if (!isOwner && !isPro && !isAdmin) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "You do not have permission to view this quotation");
    }
    return yield populateProfessionalRating(quotation);
});
const acceptQuotationToDB = (id, userId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    assertValidObjectId(id, "Quotation ID");
    const quotation = yield quotation_model_1.Quotation.findById(id);
    if (!quotation || quotation.isDeleted) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Quotation not found");
    }
    if (quotation.homeowner.toString() !== userId) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "Only the homeowner can accept this quotation");
    }
    if (quotation.status === quotation_constant_1.QUOTATION_STATUS.ACCEPTED) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "This quotation has already been accepted");
    }
    if (quotation.status === quotation_constant_1.QUOTATION_STATUS.DECLINED ||
        quotation.status === quotation_constant_1.QUOTATION_STATUS.REJECTED) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Cannot accept a quotation that was declined");
    }
    if (quotation.status === quotation_constant_1.QUOTATION_STATUS.EXPIRED) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "This quotation offer has expired and can no longer be accepted");
    }
    // Check if offerValidUntil has passed
    if (quotation.offerValidUntil &&
        new Date() > new Date(quotation.offerValidUntil)) {
        quotation.status = quotation_constant_1.QUOTATION_STATUS.EXPIRED;
        yield quotation.save();
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `This quotation offer expired on ${new Date(quotation.offerValidUntil).toLocaleDateString()}. It can no longer be accepted.`);
    }
    const jobRequest = yield jobRequest_model_1.JobRequest.findById(quotation.jobRequest);
    if (!jobRequest || jobRequest.isDeleted) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Job request not found");
    }
    if (jobRequest.status === jobRequest_1.JOB_REQUEST_STATUS.COMPLETED ||
        jobRequest.status === jobRequest_1.JOB_REQUEST_STATUS.CANCELLED) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "This job request is no longer available");
    }
    // Update Quotation to accepted and save appointment confirmation details
    quotation.status = quotation_constant_1.QUOTATION_STATUS.ACCEPTED;
    quotation.isHired = true;
    quotation.acceptedAt = new Date();
    if (payload.appointmentDate) {
        quotation.appointmentDate = new Date(payload.appointmentDate);
    }
    if (payload.paymentMethod) {
        quotation.paymentMethod = payload.paymentMethod;
    }
    if (payload.arrivalTimeWindow) {
        quotation.confirmedArrivalWindow = payload.arrivalTimeWindow;
    }
    yield quotation.save();
    // Update Job Request: mark IN_PROGRESS and assign professional
    jobRequest.status = jobRequest_1.JOB_REQUEST_STATUS.IN_PROGRESS;
    jobRequest.professional = quotation.professional;
    yield jobRequest.save();
    // Create or update the Booking record
    yield booking_model_1.Booking.findOneAndUpdate({ jobRequest: quotation.jobRequest, homeowner: quotation.homeowner }, {
        jobRequest: quotation.jobRequest,
        quotation: quotation._id,
        homeowner: quotation.homeowner,
        professional: quotation.professional,
        totalAmount: quotation.totalRate,
        appointmentDate: quotation.appointmentDate || new Date(),
        arrivalTimeWindow: quotation.confirmedArrivalWindow || quotation.arrivalTimeWindow,
        paymentMethod: quotation.paymentMethod || booking_constant_1.BOOKING_PAYMENT_METHOD.CASH,
        status: booking_constant_1.BOOKING_STATUS.SCHEDULED,
        isDeleted: false,
    }, { upsert: true, new: true, setDefaultsOnInsert: true });
    // Automatically decline any other pending quotations for this job request
    yield quotation_model_1.Quotation.updateMany({
        jobRequest: quotation.jobRequest,
        _id: { $ne: quotation._id },
        status: quotation_constant_1.QUOTATION_STATUS.PENDING,
    }, {
        $set: {
            status: quotation_constant_1.QUOTATION_STATUS.DECLINED,
            declineReason: "Another quotation was accepted for this job request",
            declinedAt: new Date(),
        },
    });
    // Notify professional
    try {
        yield (0, notificationsHelper_1.sendNotifications)({
            receiver: quotation.professional,
            sender: new mongoose_1.Types.ObjectId(userId),
            title: "Quotation Accepted!",
            text: `Congratulations! Your quotation for "${jobRequest.headline || jobRequest.title}" has been accepted. You are hired!`,
            type: notification_constant_1.NOTIFICATION_TYPE.PROFESSIONAL,
            referenceId: quotation._id,
            referenceModel: "Quotation",
        });
    }
    catch (_a) {
        // ignore notification error
    }
    realtime_socket_1.realtimeSocket.quote({
        quotationId: quotation._id,
        jobRequestId: quotation.jobRequest,
        homeownerId: quotation.homeowner,
        professionalId: quotation.professional,
        action: "accepted",
        status: quotation.status,
        broadcastProfessionals: true,
    });
    realtime_socket_1.realtimeSocket.booking({
        jobRequestId: quotation.jobRequest,
        homeownerId: quotation.homeowner,
        professionalId: quotation.professional,
        action: "created",
        status: booking_constant_1.BOOKING_STATUS.SCHEDULED,
        broadcastProfessionals: true,
    });
    const populated = yield quotation_model_1.Quotation.findById(quotation._id)
        .populate({
        path: "jobRequest",
        populate: [
            { path: "category", select: "name icon coverImage" },
            { path: "homeowner", select: "name email profileImage phone" },
        ],
    })
        .populate("homeowner", "name email profileImage phone")
        .populate({
        path: "professional",
        select: "name email profileImage phone verified city state companyName about yearsOfExperience startingRate hourlyRate category",
        populate: { path: "category", select: "name icon" },
    })
        .lean();
    return yield populateProfessionalRating(populated);
});
const declineQuotationToDB = (id, userId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    assertValidObjectId(id, "Quotation ID");
    const quotation = yield quotation_model_1.Quotation.findById(id);
    if (!quotation || quotation.isDeleted) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Quotation not found");
    }
    if (quotation.homeowner.toString() !== userId) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "Only the homeowner can decline this quotation");
    }
    if (quotation.status === quotation_constant_1.QUOTATION_STATUS.ACCEPTED) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Cannot decline an accepted quotation");
    }
    quotation.status = quotation_constant_1.QUOTATION_STATUS.DECLINED;
    quotation.declinedAt = new Date();
    if (payload === null || payload === void 0 ? void 0 : payload.reason) {
        quotation.declineReason = payload.reason;
    }
    yield quotation.save();
    const jobRequest = yield jobRequest_model_1.JobRequest.findById(quotation.jobRequest);
    // Notify professional
    try {
        yield (0, notificationsHelper_1.sendNotifications)({
            receiver: quotation.professional,
            sender: new mongoose_1.Types.ObjectId(userId),
            title: "Quotation Declined",
            text: `Your quotation for "${(jobRequest === null || jobRequest === void 0 ? void 0 : jobRequest.headline) || (jobRequest === null || jobRequest === void 0 ? void 0 : jobRequest.title) || "job request"}" was declined by the homeowner.`,
            type: notification_constant_1.NOTIFICATION_TYPE.PROFESSIONAL,
            referenceId: quotation._id,
            referenceModel: "Quotation",
        });
    }
    catch (_a) {
        // ignore notification error
    }
    realtime_socket_1.realtimeSocket.quote({
        quotationId: quotation._id,
        jobRequestId: quotation.jobRequest,
        homeownerId: quotation.homeowner,
        professionalId: quotation.professional,
        action: "declined",
        status: quotation.status,
        broadcastProfessionals: true,
    });
    const populated = yield quotation_model_1.Quotation.findById(quotation._id)
        .populate({
        path: "jobRequest",
        populate: [
            { path: "category", select: "name icon coverImage" },
            { path: "homeowner", select: "name email profileImage phone" },
        ],
    })
        .populate("homeowner", "name email profileImage phone")
        .populate({
        path: "professional",
        select: "name email profileImage phone verified city state companyName about yearsOfExperience startingRate hourlyRate category",
        populate: { path: "category", select: "name icon" },
    })
        .lean();
    return yield populateProfessionalRating(populated);
});
const getAllQuotationsFromDB = (query, userId, userRole) => __awaiter(void 0, void 0, void 0, function* () {
    const normalizedQuery = Object.assign({}, query);
    const baseFilter = {
        isDeleted: { $ne: true },
    };
    // Role scoping:
    // Homeowner sees quotes for their job requests
    // Pro sees quotes they sent
    // Admin sees all
    if (userRole === user_1.USER_ROLES.HOME_OWNER) {
        baseFilter.homeowner = new mongoose_1.Types.ObjectId(userId);
    }
    else if (userRole === user_1.USER_ROLES.PROFESSIONAL) {
        baseFilter.professional = new mongoose_1.Types.ObjectId(userId);
    }
    if (normalizedQuery.jobRequest) {
        baseFilter.jobRequest = new mongoose_1.Types.ObjectId(normalizedQuery.jobRequest);
        delete normalizedQuery.jobRequest;
    }
    const queryBuilder = new queryBuilder_1.default(quotation_model_1.Quotation.find(baseFilter)
        .populate({
        path: "jobRequest",
        populate: [
            { path: "category", select: "name icon coverImage" },
            { path: "homeowner", select: "name email profileImage phone" },
        ],
    })
        .populate("homeowner", "name email profileImage phone")
        .populate({
        path: "professional",
        select: "name email profileImage phone verified city state companyName about yearsOfExperience startingRate hourlyRate category",
        populate: { path: "category", select: "name icon" },
    }), normalizedQuery)
        .search(quotation_constant_1.quotationSearchableFields)
        .filter()
        .sort();
    queryBuilder.paginate();
    const [data, meta] = yield Promise.all([
        queryBuilder.modelQuery.lean(),
        queryBuilder.countTotal(),
    ]);
    const enrichedData = yield Promise.all(data.map((quote) => populateProfessionalRating(quote)));
    return { data: enrichedData, meta };
});
const getQuotationsForJobRequest = (jobRequestId, viewerId, viewerRole) => __awaiter(void 0, void 0, void 0, function* () {
    const query = {
        jobRequest: new mongoose_1.Types.ObjectId(jobRequestId),
        isDeleted: { $ne: true },
    };
    // If viewed by a professional, only show their own quotation
    if (viewerRole === user_1.USER_ROLES.PROFESSIONAL && viewerId) {
        query.professional = new mongoose_1.Types.ObjectId(viewerId);
    }
    const quotes = yield quotation_model_1.Quotation.find(query)
        .populate({
        path: "professional",
        select: "name email profileImage phone verified city state companyName about yearsOfExperience startingRate hourlyRate category",
        populate: { path: "category", select: "name icon" },
    })
        .sort({ createdAt: -1 })
        .lean();
    return yield Promise.all(quotes.map((quote) => populateProfessionalRating(quote)));
});
exports.QuotationService = {
    createQuotationToDB,
    getQuotationByIdFromDB,
    acceptQuotationToDB,
    declineQuotationToDB,
    getAllQuotationsFromDB,
    getQuotationsForJobRequest,
};
