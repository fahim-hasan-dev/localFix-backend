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
exports.JobRequestService = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const http_status_codes_1 = require("http-status-codes");
const user_1 = require("../../../enums/user");
const ApiErrors_1 = __importDefault(require("../../../errors/ApiErrors"));
const queryBuilder_1 = __importDefault(require("../../builder/queryBuilder"));
const category_model_1 = require("../category/category.model");
const user_model_1 = require("../user/user.model");
const jobRequest_model_1 = require("./jobRequest.model");
const notificationsHelper_1 = require("../../../helpers/notificationsHelper");
const notification_constant_1 = require("../notification/notification.constant");
const searchHelper_1 = require("../../../helpers/searchHelper");
const jobRequest_1 = require("../../../enums/jobRequest");
const quotation_service_1 = require("../quotation/quotation.service");
const quotation_model_1 = require("../quotation/quotation.model");
const booking_model_1 = require("../booking/booking.model");
const realtime_socket_1 = require("../realtime/realtime.socket");
const isAdminRole = (role) => role === user_1.USER_ROLES.ADMIN || role === user_1.USER_ROLES.SUPER_ADMIN;
const assertValidObjectId = (id, entity = "ID") => {
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Invalid ${entity}`);
    }
};
const normalizeServiceLocation = (payload) => {
    const existingLoc = payload.serviceLocation || {};
    return {
        zipCode: (existingLoc.zipCode || payload.zipCode || "").trim(),
        address: (existingLoc.address || payload.address || "").trim(),
        city: (existingLoc.city || payload.city || "").trim(),
        state: (existingLoc.state || payload.state || "").trim(),
        location: existingLoc.location,
    };
};
const createJobRequestToDB = (userId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    assertValidObjectId(payload.category, "Category ID");
    const categoryExists = yield category_model_1.Category.findById(payload.category);
    if (!categoryExists) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Category not found");
    }
    if (payload.professional) {
        assertValidObjectId(payload.professional, "Professional ID");
        const proUser = yield user_model_1.User.findById(payload.professional);
        if (!proUser || proUser.role !== user_1.USER_ROLES.PROFESSIONAL) {
            throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Professional not found");
        }
    }
    const headline = (payload.headline || payload.title || "").trim();
    const title = (payload.title || payload.headline || "").trim();
    const serviceLocation = normalizeServiceLocation(payload);
    if (!serviceLocation.zipCode) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Service location ZIP code is required");
    }
    const isUrgent = payload.isUrgent !== undefined
        ? Boolean(payload.isUrgent)
        : /urgent|asap|emergency/i.test(payload.timeframe || "");
    const jobRequestData = Object.assign(Object.assign({}, payload), { homeowner: new mongoose_1.Types.ObjectId(userId), category: new mongoose_1.Types.ObjectId(payload.category), professional: payload.professional
            ? new mongoose_1.Types.ObjectId(payload.professional)
            : null, headline,
        title,
        serviceLocation,
        isUrgent, projectPhotos: Array.isArray(payload.projectPhotos)
            ? payload.projectPhotos
            : [], estimatedBudget: payload.estimatedBudget !== undefined && payload.estimatedBudget !== null
            ? Number(payload.estimatedBudget)
            : 0 });
    const createdJobRequest = yield jobRequest_model_1.JobRequest.create(jobRequestData);
    // If a specific professional was targeted, notify them
    if (payload.professional) {
        try {
            yield (0, notificationsHelper_1.sendNotifications)({
                receiver: payload.professional,
                sender: new mongoose_1.Types.ObjectId(userId),
                title: "New Job Request",
                text: `You have received a new service request: "${headline}"`,
                type: notification_constant_1.NOTIFICATION_TYPE.PROFESSIONAL,
                referenceId: createdJobRequest._id,
                referenceModel: "JobRequest",
            });
        }
        catch (_a) {
            // Notification errors should not block request creation
        }
    }
    realtime_socket_1.realtimeSocket.job({
        jobRequestId: createdJobRequest._id,
        homeownerId: userId,
        professionalId: payload.professional,
        action: "created",
        status: createdJobRequest.status,
        broadcastProfessionals: !payload.professional,
    });
    const populated = yield jobRequest_model_1.JobRequest.findById(createdJobRequest._id)
        .populate("category", "name icon coverImage")
        .populate("homeowner", "name email profileImage phone")
        .populate("professional", "name email profileImage phone companyName")
        .lean();
    return Object.assign(Object.assign({}, populated), { isDirect: Boolean(populated === null || populated === void 0 ? void 0 : populated.professional) });
});
const getMyJobRequestsFromDB = (userId_1, userRole_1, ...args_1) => __awaiter(void 0, [userId_1, userRole_1, ...args_1], void 0, function* (userId, userRole, query = {}) {
    const normalizedQuery = Object.assign({}, query);
    const baseFilter = {};
    if (!isAdminRole(userRole)) {
        baseFilter.homeowner = new mongoose_1.Types.ObjectId(userId);
    }
    else if (normalizedQuery.homeowner) {
        baseFilter.homeowner = new mongoose_1.Types.ObjectId(normalizedQuery.homeowner);
        delete normalizedQuery.homeowner;
    }
    const searchableFields = [
        "headline",
        "title",
        "description",
        "serviceLocation.zipCode",
        "serviceLocation.city",
        "serviceLocation.address",
        "propertyType",
        "timeframe",
    ];
    const queryBuilder = new queryBuilder_1.default(jobRequest_model_1.JobRequest.find(baseFilter)
        .populate("category", "name icon coverImage")
        .populate("professional", "name email profileImage phone companyName")
        .populate("homeowner", "name email profileImage phone"), normalizedQuery)
        .search(searchableFields)
        .filter()
        .sort();
    queryBuilder.paginate();
    const [data, meta] = yield Promise.all([
        queryBuilder.modelQuery.lean(),
        queryBuilder.countTotal(),
    ]);
    const formattedData = data.map((item) => (Object.assign(Object.assign({}, item), { quotesCount: typeof item.quotesCount === "number" ? item.quotesCount : 0 })));
    return { data: formattedData, meta };
});
const getJobRequestByIdFromDB = (id, userId, userRole) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    assertValidObjectId(id, "Job Request ID");
    const jobRequest = yield jobRequest_model_1.JobRequest.findById(id)
        .populate("category", "name icon coverImage")
        .populate("homeowner", "name email profileImage phone city state zipCode streetAddress")
        .populate("professional", "name email profileImage phone companyName about yearsOfExperience")
        .lean();
    if (!jobRequest) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Job request not found");
    }
    const homeownerId = ((_b = (_a = jobRequest.homeowner) === null || _a === void 0 ? void 0 : _a._id) === null || _b === void 0 ? void 0 : _b.toString()) ||
        ((_c = jobRequest.homeowner) === null || _c === void 0 ? void 0 : _c.toString());
    const professionalId = ((_e = (_d = jobRequest.professional) === null || _d === void 0 ? void 0 : _d._id) === null || _e === void 0 ? void 0 : _e.toString()) ||
        ((_f = jobRequest.professional) === null || _f === void 0 ? void 0 : _f.toString());
    const isOwner = homeownerId === userId;
    const isTargetedPro = professionalId === userId;
    const isAdmin = isAdminRole(userRole);
    const isOpenMarketplaceLead = !professionalId && userRole === user_1.USER_ROLES.PROFESSIONAL;
    // Check if pro submitted a quotation for this request
    const hasQuoted = yield quotation_model_1.Quotation.exists({
        jobRequest: new mongoose_1.Types.ObjectId(id),
        professional: new mongoose_1.Types.ObjectId(userId),
        isDeleted: { $ne: true },
    });
    if (!isOwner &&
        !isTargetedPro &&
        !isAdmin &&
        !isOpenMarketplaceLead &&
        !hasQuoted) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "You do not have permission to view this job request");
    }
    const rejectedBy = (jobRequest.rejectedBy || []).map((u) => u.toString());
    const isRejectedByMe = rejectedBy.includes(userId);
    // Fetch quotations for this job request
    const quotations = yield quotation_service_1.QuotationService.getQuotationsForJobRequest(id, userId, userRole);
    const quotesCount = typeof jobRequest.quotesCount === "number" &&
        jobRequest.quotesCount > 0
        ? jobRequest.quotesCount
        : quotations.length;
    // Fetch booking if exists
    const booking = yield booking_model_1.Booking.findOne({
        jobRequest: new mongoose_1.Types.ObjectId(id),
        isDeleted: { $ne: true },
    })
        .populate({
        path: "professional",
        select: "name profileImage verified city state companyName",
    })
        .populate("homeowner", "name email profileImage phone city state zipCode")
        .lean();
    return Object.assign(Object.assign({}, jobRequest), { quotesCount,
        quotations, booking: booking || null, isRejectedByMe });
});
const updateJobRequestToDB = (id, userId, userRole, payload) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    assertValidObjectId(id, "Job Request ID");
    const existing = yield jobRequest_model_1.JobRequest.findById(id);
    if (!existing) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Job request not found");
    }
    const isOwner = existing.homeowner.toString() === userId;
    if (!isOwner && !isAdminRole(userRole)) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "You do not have permission to update this job request");
    }
    if (payload.category) {
        assertValidObjectId(payload.category, "Category ID");
        const categoryExists = yield category_model_1.Category.findById(payload.category);
        if (!categoryExists) {
            throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Category not found");
        }
    }
    if (payload.professional) {
        assertValidObjectId(payload.professional, "Professional ID");
        const proUser = yield user_model_1.User.findById(payload.professional);
        if (!proUser || proUser.role !== user_1.USER_ROLES.PROFESSIONAL) {
            throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Professional not found");
        }
    }
    const updateData = Object.assign({}, payload);
    if (payload.headline || payload.title) {
        const headline = payload.headline || payload.title;
        updateData.headline = headline;
        updateData.title = payload.title || headline;
    }
    if (payload.timeframe !== undefined || payload.isUrgent !== undefined) {
        updateData.isUrgent =
            payload.isUrgent !== undefined
                ? Boolean(payload.isUrgent)
                : /urgent|asap|emergency/i.test(payload.timeframe || existing.timeframe || "");
    }
    if (payload.estimatedBudget !== undefined &&
        payload.estimatedBudget !== null) {
        updateData.estimatedBudget = Number(payload.estimatedBudget);
    }
    if (payload.serviceLocation ||
        payload.zipCode ||
        payload.address ||
        payload.city ||
        payload.state) {
        updateData.serviceLocation = {
            zipCode: ((_a = payload.serviceLocation) === null || _a === void 0 ? void 0 : _a.zipCode) ||
                payload.zipCode ||
                existing.serviceLocation.zipCode,
            address: (_d = (_c = (_b = payload.serviceLocation) === null || _b === void 0 ? void 0 : _b.address) !== null && _c !== void 0 ? _c : payload.address) !== null && _d !== void 0 ? _d : existing.serviceLocation.address,
            city: (_g = (_f = (_e = payload.serviceLocation) === null || _e === void 0 ? void 0 : _e.city) !== null && _f !== void 0 ? _f : payload.city) !== null && _g !== void 0 ? _g : existing.serviceLocation.city,
            state: (_k = (_j = (_h = payload.serviceLocation) === null || _h === void 0 ? void 0 : _h.state) !== null && _j !== void 0 ? _j : payload.state) !== null && _k !== void 0 ? _k : existing.serviceLocation.state,
            location: (_m = (_l = payload.serviceLocation) === null || _l === void 0 ? void 0 : _l.location) !== null && _m !== void 0 ? _m : existing.serviceLocation.location,
        };
    }
    const updated = yield jobRequest_model_1.JobRequest.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
    })
        .populate("category", "name icon coverImage")
        .populate("homeowner", "name email profileImage phone")
        .populate("professional", "name email profileImage phone companyName")
        .lean();
    realtime_socket_1.realtimeSocket.job({
        jobRequestId: updated === null || updated === void 0 ? void 0 : updated._id,
        homeownerId: updated === null || updated === void 0 ? void 0 : updated.homeowner,
        professionalId: updated === null || updated === void 0 ? void 0 : updated.professional,
        action: "updated",
        status: updated === null || updated === void 0 ? void 0 : updated.status,
        broadcastProfessionals: !(updated === null || updated === void 0 ? void 0 : updated.professional),
    });
    return updated;
});
const deleteJobRequestFromDB = (id, userId, userRole) => __awaiter(void 0, void 0, void 0, function* () {
    assertValidObjectId(id, "Job Request ID");
    const existing = yield jobRequest_model_1.JobRequest.findById(id);
    if (!existing) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Job request not found");
    }
    const isOwner = existing.homeowner.toString() === userId;
    if (!isOwner && !isAdminRole(userRole)) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "You do not have permission to delete this job request");
    }
    const result = yield jobRequest_model_1.JobRequest.softDeleteById(id);
    realtime_socket_1.realtimeSocket.job({
        jobRequestId: existing._id,
        homeownerId: existing.homeowner,
        professionalId: existing.professional,
        action: "deleted",
        status: existing.status,
        broadcastProfessionals: !existing.professional,
    });
    return result;
});
const getMarketplaceLeadsFromDB = (userId_1, ...args_1) => __awaiter(void 0, [userId_1, ...args_1], void 0, function* (userId, query = {}) {
    const normalizedQuery = Object.assign({}, query);
    const proObjectId = new mongoose_1.Types.ObjectId(userId);
    // Base filter for marketplace leads:
    // 1. Open request (no specific professional assigned)
    // 2. Not rejected by this professional
    // 3. Not soft-deleted
    const baseFilter = {
        professional: null,
        rejectedBy: { $ne: proObjectId },
        isDeleted: { $ne: true },
    };
    // Status filter (default to awaiting_quotes & quoted)
    if (normalizedQuery.status) {
        baseFilter.status = normalizedQuery.status;
        delete normalizedQuery.status;
    }
    else {
        baseFilter.status = {
            $in: [jobRequest_1.JOB_REQUEST_STATUS.AWAITING_QUOTES, jobRequest_1.JOB_REQUEST_STATUS.QUOTED],
        };
    }
    // Category filter
    const categoryParam = (normalizedQuery.category ||
        normalizedQuery.tradeCategory ||
        normalizedQuery.categoryId);
    delete normalizedQuery.category;
    delete normalizedQuery.tradeCategory;
    delete normalizedQuery.categoryId;
    if (categoryParam &&
        categoryParam !== "all" &&
        categoryParam.toLowerCase() !== "all trade categories") {
        if (mongoose_1.default.Types.ObjectId.isValid(categoryParam)) {
            baseFilter.category = new mongoose_1.Types.ObjectId(categoryParam);
        }
        else {
            const matchedCat = yield category_model_1.Category.findOne({
                name: {
                    $regex: new RegExp(`^${(0, searchHelper_1.escapeRegex)(categoryParam.trim())}$`, "i"),
                },
            }).select("_id");
            if (matchedCat) {
                baseFilter.category = matchedCat._id;
            }
            else {
                baseFilter.category = new mongoose_1.Types.ObjectId();
            }
        }
    }
    // Search filter
    const searchTerm = (normalizedQuery.searchTerm ||
        normalizedQuery.search ||
        normalizedQuery.q);
    delete normalizedQuery.searchTerm;
    delete normalizedQuery.search;
    delete normalizedQuery.q;
    if (searchTerm && searchTerm.trim()) {
        const trimmed = searchTerm.trim();
        const searchRegex = (0, searchHelper_1.buildFuzzySearchRegex)(trimmed) || new RegExp((0, searchHelper_1.escapeRegex)(trimmed), "i");
        const [matchingHomeowners, matchingCategories] = yield Promise.all([
            user_model_1.User.find({ name: searchRegex }).select("_id"),
            category_model_1.Category.find({ name: searchRegex }).select("_id"),
        ]);
        const matchingUserIds = matchingHomeowners.map((u) => u._id);
        const matchingCategoryIds = matchingCategories.map((c) => c._id);
        const searchConditions = [
            { headline: searchRegex },
            { title: searchRegex },
            { description: searchRegex },
            { "serviceLocation.city": searchRegex },
            { "serviceLocation.address": searchRegex },
            { "serviceLocation.zipCode": searchRegex },
            { "serviceLocation.state": searchRegex },
            { propertyType: searchRegex },
            { timeframe: searchRegex },
            { partsAndMaterials: searchRegex },
        ];
        if (matchingUserIds.length > 0) {
            searchConditions.push({ homeowner: { $in: matchingUserIds } });
        }
        if (matchingCategoryIds.length > 0) {
            searchConditions.push({ category: { $in: matchingCategoryIds } });
        }
        baseFilter.$or = searchConditions;
    }
    // Sort normalization ("Newest First", "Most Urgent", "Highest Budget")
    const rawSort = String(normalizedQuery.sort || normalizedQuery.sortBy || "").trim();
    delete normalizedQuery.sort;
    delete normalizedQuery.sortBy;
    let sortOption = { createdAt: -1 };
    if (/urgent/i.test(rawSort)) {
        sortOption = { isUrgent: -1, createdAt: -1 };
    }
    else if (/budget/i.test(rawSort) ||
        rawSort === "highest_budget" ||
        rawSort === "-estimatedBudget") {
        sortOption = { estimatedBudget: -1, createdAt: -1 };
    }
    else if (/newest/i.test(rawSort) || rawSort === "-createdAt" || !rawSort) {
        sortOption = { createdAt: -1 };
    }
    else {
        sortOption = rawSort.split(",").join(" ");
    }
    // Pagination
    const page = Math.max(1, Number(normalizedQuery.page) || 1);
    const limit = Math.max(1, Number(normalizedQuery.limit) || 10);
    const skip = (page - 1) * limit;
    delete normalizedQuery.page;
    delete normalizedQuery.limit;
    const finalFilter = Object.assign(Object.assign({}, baseFilter), normalizedQuery);
    const [data, total] = yield Promise.all([
        jobRequest_model_1.JobRequest.find(finalFilter)
            .populate("category", "name icon coverImage")
            .populate("homeowner", "name email profileImage phone city state zipCode streetAddress")
            .sort(sortOption)
            .skip(skip)
            .limit(limit)
            .lean(),
        jobRequest_model_1.JobRequest.countDocuments(finalFilter),
    ]);
    const totalPage = Math.ceil(total / limit);
    return {
        meta: {
            page,
            limit,
            total,
            totalPage,
        },
        data: data.map((item) => (Object.assign(Object.assign({}, item), { isDirect: false }))),
    };
});
const getDirectRequestsFromDB = (userId_1, ...args_1) => __awaiter(void 0, [userId_1, ...args_1], void 0, function* (userId, query = {}) {
    const normalizedQuery = Object.assign({}, query);
    const proObjectId = new mongoose_1.Types.ObjectId(userId);
    // Base filter for direct requests:
    // 1. Specifically assigned to this professional
    // 2. Not rejected by this professional
    // 3. Not soft-deleted
    const baseFilter = {
        professional: proObjectId,
        rejectedBy: { $ne: proObjectId },
        isDeleted: { $ne: true },
    };
    // Status filter (default to awaiting_quotes & quoted)
    if (normalizedQuery.status) {
        if (normalizedQuery.status !== "all") {
            baseFilter.status = normalizedQuery.status;
        }
        delete normalizedQuery.status;
    }
    else {
        baseFilter.status = {
            $in: [jobRequest_1.JOB_REQUEST_STATUS.AWAITING_QUOTES, jobRequest_1.JOB_REQUEST_STATUS.QUOTED],
        };
    }
    // Category filter
    const categoryParam = (normalizedQuery.category ||
        normalizedQuery.tradeCategory ||
        normalizedQuery.categoryId);
    delete normalizedQuery.category;
    delete normalizedQuery.tradeCategory;
    delete normalizedQuery.categoryId;
    if (categoryParam &&
        categoryParam !== "all" &&
        categoryParam.toLowerCase() !== "all trade categories") {
        if (mongoose_1.default.Types.ObjectId.isValid(categoryParam)) {
            baseFilter.category = new mongoose_1.Types.ObjectId(categoryParam);
        }
        else {
            const matchedCat = yield category_model_1.Category.findOne({
                name: {
                    $regex: new RegExp(`^${(0, searchHelper_1.escapeRegex)(categoryParam.trim())}$`, "i"),
                },
            }).select("_id");
            if (matchedCat) {
                baseFilter.category = matchedCat._id;
            }
            else {
                baseFilter.category = new mongoose_1.Types.ObjectId();
            }
        }
    }
    // Search filter
    const searchTerm = (normalizedQuery.searchTerm ||
        normalizedQuery.search ||
        normalizedQuery.q);
    delete normalizedQuery.searchTerm;
    delete normalizedQuery.search;
    delete normalizedQuery.q;
    if (searchTerm && searchTerm.trim()) {
        const trimmed = searchTerm.trim();
        const searchRegex = (0, searchHelper_1.buildFuzzySearchRegex)(trimmed) || new RegExp((0, searchHelper_1.escapeRegex)(trimmed), "i");
        const [matchingHomeowners, matchingCategories] = yield Promise.all([
            user_model_1.User.find({ name: searchRegex }).select("_id"),
            category_model_1.Category.find({ name: searchRegex }).select("_id"),
        ]);
        const matchingUserIds = matchingHomeowners.map((u) => u._id);
        const matchingCategoryIds = matchingCategories.map((c) => c._id);
        const searchConditions = [
            { headline: searchRegex },
            { title: searchRegex },
            { description: searchRegex },
            { "serviceLocation.city": searchRegex },
            { "serviceLocation.address": searchRegex },
            { "serviceLocation.zipCode": searchRegex },
            { "serviceLocation.state": searchRegex },
            { propertyType: searchRegex },
            { timeframe: searchRegex },
            { partsAndMaterials: searchRegex },
        ];
        if (matchingUserIds.length > 0) {
            searchConditions.push({ homeowner: { $in: matchingUserIds } });
        }
        if (matchingCategoryIds.length > 0) {
            searchConditions.push({ category: { $in: matchingCategoryIds } });
        }
        baseFilter.$or = searchConditions;
    }
    // Sort normalization ("Newest First", "Most Urgent", "Highest Budget")
    const rawSort = String(normalizedQuery.sort || normalizedQuery.sortBy || "").trim();
    delete normalizedQuery.sort;
    delete normalizedQuery.sortBy;
    let sortOption = { createdAt: -1 };
    if (/urgent/i.test(rawSort)) {
        sortOption = { isUrgent: -1, createdAt: -1 };
    }
    else if (/budget/i.test(rawSort) ||
        rawSort === "highest_budget" ||
        rawSort === "-estimatedBudget") {
        sortOption = { estimatedBudget: -1, createdAt: -1 };
    }
    else if (/newest/i.test(rawSort) || rawSort === "-createdAt" || !rawSort) {
        sortOption = { createdAt: -1 };
    }
    else {
        sortOption = rawSort.split(",").join(" ");
    }
    // Pagination
    const page = Math.max(1, Number(normalizedQuery.page) || 1);
    const limit = Math.max(1, Number(normalizedQuery.limit) || 10);
    const skip = (page - 1) * limit;
    delete normalizedQuery.page;
    delete normalizedQuery.limit;
    const finalFilter = Object.assign(Object.assign({}, baseFilter), normalizedQuery);
    const [data, total] = yield Promise.all([
        jobRequest_model_1.JobRequest.find(finalFilter)
            .populate("category", "name icon coverImage")
            .populate("homeowner", "name email profileImage phone city state zipCode streetAddress")
            .populate("professional", "name email profileImage phone companyName")
            .sort(sortOption)
            .skip(skip)
            .limit(limit)
            .lean(),
        jobRequest_model_1.JobRequest.countDocuments(finalFilter),
    ]);
    const totalPage = Math.ceil(total / limit);
    return {
        meta: {
            page,
            limit,
            total,
            totalPage,
        },
        data: data.map((item) => (Object.assign(Object.assign({}, item), { isDirect: true }))),
    };
});
const getSingleDirectRequestFromDB = (id, userId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    assertValidObjectId(id, "Job Request ID");
    const jobRequest = yield jobRequest_model_1.JobRequest.findById(id)
        .populate("category", "name icon coverImage")
        .populate("homeowner", "name email profileImage phone city state zipCode streetAddress")
        .populate("professional", "name email profileImage phone companyName")
        .lean();
    if (!jobRequest) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Direct job request not found");
    }
    const professionalId = ((_b = (_a = jobRequest.professional) === null || _a === void 0 ? void 0 : _a._id) === null || _b === void 0 ? void 0 : _b.toString()) ||
        ((_c = jobRequest.professional) === null || _c === void 0 ? void 0 : _c.toString());
    if (professionalId !== userId) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "You do not have permission to view this direct job request");
    }
    const rejectedBy = (jobRequest.rejectedBy || []).map((u) => u.toString());
    const isRejectedByMe = rejectedBy.includes(userId);
    return Object.assign(Object.assign({}, jobRequest), { isDirect: true, isRejectedByMe });
});
const rejectJobRequestInDB = (requestId, userId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    assertValidObjectId(requestId, "Job Request ID");
    const existing = yield jobRequest_model_1.JobRequest.findById(requestId);
    if (!existing) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Job request not found");
    }
    const professionalId = ((_b = (_a = existing.professional) === null || _a === void 0 ? void 0 : _a._id) === null || _b === void 0 ? void 0 : _b.toString()) ||
        ((_c = existing.professional) === null || _c === void 0 ? void 0 : _c.toString());
    // If this was a direct request to ANOTHER professional, deny access
    if (professionalId && professionalId !== userId) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "You do not have permission to reject this job request");
    }
    const proObjectId = new mongoose_1.Types.ObjectId(userId);
    yield jobRequest_model_1.JobRequest.findByIdAndUpdate(requestId, {
        $addToSet: { rejectedBy: proObjectId },
    }, { new: true });
    // If this was a direct request to this professional, notify the homeowner
    if (professionalId === userId) {
        try {
            const proUser = yield user_model_1.User.findById(userId).select("name companyName");
            const proName = (proUser === null || proUser === void 0 ? void 0 : proUser.companyName) || (proUser === null || proUser === void 0 ? void 0 : proUser.name) || "The professional";
            yield (0, notificationsHelper_1.sendNotifications)({
                receiver: existing.homeowner,
                sender: proObjectId,
                title: "Direct Request Declined",
                text: `${proName} has declined your direct request: "${existing.headline}"`,
                type: notification_constant_1.NOTIFICATION_TYPE.HOME_OWNER,
                referenceId: existing._id,
                referenceModel: "JobRequest",
            });
        }
        catch (_d) {
            // Notification errors should not block reject operation
        }
    }
    realtime_socket_1.realtimeSocket.job({
        jobRequestId: existing._id,
        homeownerId: existing.homeowner,
        professionalId: userId,
        action: "rejected",
        status: existing.status,
    });
    return {
        id: requestId,
        rejected: true,
    };
});
const rejectDirectRequestInDB = (requestId, userId) => __awaiter(void 0, void 0, void 0, function* () {
    return rejectJobRequestInDB(requestId, userId);
});
const rejectMarketplaceLeadInDB = (leadId, userId) => __awaiter(void 0, void 0, void 0, function* () {
    return rejectJobRequestInDB(leadId, userId);
});
const getQuoteRequestsCountFromDB = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const proObjectId = new mongoose_1.Types.ObjectId(userId);
    const directFilter = {
        professional: proObjectId,
        rejectedBy: { $ne: proObjectId },
        isDeleted: { $ne: true },
        status: {
            $in: [jobRequest_1.JOB_REQUEST_STATUS.AWAITING_QUOTES, jobRequest_1.JOB_REQUEST_STATUS.QUOTED],
        },
    };
    const marketplaceFilter = {
        professional: null,
        rejectedBy: { $ne: proObjectId },
        isDeleted: { $ne: true },
        status: {
            $in: [jobRequest_1.JOB_REQUEST_STATUS.AWAITING_QUOTES, jobRequest_1.JOB_REQUEST_STATUS.QUOTED],
        },
    };
    const [directRequests, marketplaceLeads, myProposals] = yield Promise.all([
        jobRequest_model_1.JobRequest.countDocuments(directFilter),
        jobRequest_model_1.JobRequest.countDocuments(marketplaceFilter),
        quotation_model_1.Quotation.countDocuments({
            professional: proObjectId,
            isDeleted: { $ne: true },
        }),
    ]);
    return {
        directRequests,
        marketplaceLeads,
        myProposals,
    };
});
const getMyProposalsFromDB = (userId_1, ...args_1) => __awaiter(void 0, [userId_1, ...args_1], void 0, function* (userId, query = {}) {
    const normalizedQuery = Object.assign({}, query);
    const proObjectId = new mongoose_1.Types.ObjectId(userId);
    const baseFilter = {
        professional: proObjectId,
        isDeleted: { $ne: true },
    };
    // Status filter if specified
    if (normalizedQuery.status && normalizedQuery.status !== "all") {
        baseFilter.status = normalizedQuery.status;
        delete normalizedQuery.status;
    }
    // Category filter
    const categoryParam = normalizedQuery.category;
    if (categoryParam) {
        delete normalizedQuery.category;
    }
    // Search filter
    const searchTerm = normalizedQuery.searchTerm;
    if (searchTerm) {
        delete normalizedQuery.searchTerm;
    }
    // Query all proposals submitted by this professional
    const quotationQuery = quotation_model_1.Quotation.find(baseFilter)
        .populate({
        path: "jobRequest",
        populate: [
            { path: "category", select: "name icon coverImage" },
            {
                path: "homeowner",
                select: "name email profileImage phone city state zipCode",
            },
        ],
    })
        .populate("homeowner", "name email profileImage phone city state zipCode")
        .sort({ createdAt: -1 });
    const rawQuotations = yield quotationQuery.lean();
    // In-memory filter for category and searchTerm
    let filtered = rawQuotations;
    if (categoryParam) {
        filtered = filtered.filter((q) => {
            var _a, _b, _c;
            const cat = (_a = q.jobRequest) === null || _a === void 0 ? void 0 : _a.category;
            if (!cat)
                return false;
            const catId = ((_b = cat._id) === null || _b === void 0 ? void 0 : _b.toString()) || cat.toString();
            const catName = ((_c = cat.name) === null || _c === void 0 ? void 0 : _c.toLowerCase()) || "";
            return (catId === categoryParam ||
                catName === categoryParam.toLowerCase() ||
                catName.includes(categoryParam.toLowerCase()));
        });
    }
    if (searchTerm) {
        const s = searchTerm.toLowerCase();
        filtered = filtered.filter((q) => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
            const headline = ((_b = (_a = q.jobRequest) === null || _a === void 0 ? void 0 : _a.headline) === null || _b === void 0 ? void 0 : _b.toLowerCase()) || "";
            const title = ((_d = (_c = q.jobRequest) === null || _c === void 0 ? void 0 : _c.title) === null || _d === void 0 ? void 0 : _d.toLowerCase()) || "";
            const clientName = ((_f = (_e = q.homeowner) === null || _e === void 0 ? void 0 : _e.name) === null || _f === void 0 ? void 0 : _f.toLowerCase()) || "";
            const city = ((_j = (_h = (_g = q.jobRequest) === null || _g === void 0 ? void 0 : _g.serviceLocation) === null || _h === void 0 ? void 0 : _h.city) === null || _j === void 0 ? void 0 : _j.toLowerCase()) || "";
            const address = ((_m = (_l = (_k = q.jobRequest) === null || _k === void 0 ? void 0 : _k.serviceLocation) === null || _l === void 0 ? void 0 : _l.address) === null || _m === void 0 ? void 0 : _m.toLowerCase()) || "";
            return (headline.includes(s) ||
                title.includes(s) ||
                clientName.includes(s) ||
                city.includes(s) ||
                address.includes(s));
        });
    }
    // Pagination
    const page = Number(normalizedQuery.page) || 1;
    const limit = Number(normalizedQuery.limit) || 10;
    const total = filtered.length;
    const totalPage = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);
    // Attach associated booking info for each proposal
    const data = yield Promise.all(paginated.map((quote) => __awaiter(void 0, void 0, void 0, function* () {
        const booking = yield booking_model_1.Booking.findOne({
            quotation: quote._id,
            isDeleted: { $ne: true },
        })
            .select("status appointmentDate arrivalTimeWindow paymentMethod totalAmount workStartedAt contractorCompletedAt homeownerCompletedAt")
            .lean();
        return Object.assign(Object.assign({}, quote), { booking: booking || null });
    })));
    return {
        data,
        meta: {
            page,
            limit,
            total,
            totalPage,
        },
    };
});
const getSingleMarketplaceLeadFromDB = (id, userId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    assertValidObjectId(id, "Job Request ID");
    const jobRequest = yield jobRequest_model_1.JobRequest.findById(id)
        .populate("category", "name icon coverImage")
        .populate("homeowner", "name email profileImage phone city state zipCode streetAddress")
        .lean();
    if (!jobRequest) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Marketplace lead not found");
    }
    const professionalId = ((_b = (_a = jobRequest.professional) === null || _a === void 0 ? void 0 : _a._id) === null || _b === void 0 ? void 0 : _b.toString()) ||
        ((_c = jobRequest.professional) === null || _c === void 0 ? void 0 : _c.toString());
    // If this lead was directly assigned/targeted to someone else, reject access
    if (professionalId && professionalId !== userId) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "You do not have permission to view this job request");
    }
    const rejectedBy = (jobRequest.rejectedBy || []).map((u) => u.toString());
    const isRejectedByMe = rejectedBy.includes(userId);
    return Object.assign(Object.assign({}, jobRequest), { isDirect: false, isRejectedByMe });
});
exports.JobRequestService = {
    createJobRequestToDB,
    getMyJobRequestsFromDB,
    getJobRequestByIdFromDB,
    updateJobRequestToDB,
    deleteJobRequestFromDB,
    getMarketplaceLeadsFromDB,
    getSingleMarketplaceLeadFromDB,
    rejectMarketplaceLeadInDB,
    getDirectRequestsFromDB,
    getSingleDirectRequestFromDB,
    rejectDirectRequestInDB,
    rejectJobRequestInDB,
    getQuoteRequestsCountFromDB,
    getMyProposalsFromDB,
};
