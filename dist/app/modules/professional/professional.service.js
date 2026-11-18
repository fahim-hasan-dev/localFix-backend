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
exports.ProfessionalService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const http_status_codes_1 = require("http-status-codes");
const user_1 = require("../../../enums/user");
const jobRequest_1 = require("../../../enums/jobRequest");
const ApiErrors_1 = __importDefault(require("../../../errors/ApiErrors"));
const searchHelper_1 = require("../../../helpers/searchHelper");
const category_model_1 = require("../category/category.model");
const review_model_1 = require("../review/review.model");
const user_model_1 = require("../user/user.model");
const service_model_1 = require("../service/service.model");
const jobRequest_model_1 = require("../jobRequest/jobRequest.model");
const booking_model_1 = require("../booking/booking.model");
const booking_constant_1 = require("../booking/booking.constant");
const favorite_service_1 = require("../favorite/favorite.service");
const googleMapsHelper_1 = require("../../../helpers/googleMapsHelper");
const assertValidObjectId = (id, label = "professional") => {
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Invalid ${label} ID`);
    }
};
const parseBudgetFilter = (query) => {
    var _a, _b;
    let minBudget;
    let maxBudget;
    const rawMin = (_a = query.minBudget) !== null && _a !== void 0 ? _a : query.minPrice;
    if (rawMin !== undefined && rawMin !== null && rawMin !== "") {
        const parsed = Number(rawMin);
        if (!isNaN(parsed))
            minBudget = parsed;
    }
    const rawMax = (_b = query.maxBudget) !== null && _b !== void 0 ? _b : query.maxPrice;
    if (rawMax !== undefined && rawMax !== null && rawMax !== "") {
        const parsed = Number(rawMax);
        if (!isNaN(parsed))
            maxBudget = parsed;
    }
    const rawBudget = query.budget;
    if (rawBudget && typeof rawBudget === "string") {
        const normalized = rawBudget.trim().toLowerCase();
        if (normalized === "under-85" ||
            normalized === "under_85" ||
            normalized === "under 85" ||
            normalized === "value" ||
            normalized === "<85" ||
            normalized === "<=85") {
            maxBudget = 85;
        }
        else if (normalized === "85-130" ||
            normalized === "85_130" ||
            normalized === "85 - 130" ||
            normalized === "mid-range" ||
            normalized === "mid_range") {
            minBudget = 85;
            maxBudget = 130;
        }
        else if (normalized === "above-130" ||
            normalized === "above_130" ||
            normalized === "above 130" ||
            normalized === "130-above" ||
            normalized === "130 & above" ||
            normalized === "high-end" ||
            normalized === "high_end" ||
            normalized === ">130" ||
            normalized === ">=130") {
            minBudget = 130;
        }
        else if (normalized.includes("-")) {
            const parts = normalized.split("-").map((p) => Number(p.trim()));
            if (!isNaN(parts[0]))
                minBudget = parts[0];
            if (parts[1] && !isNaN(parts[1]))
                maxBudget = parts[1];
        }
    }
    return { minBudget, maxBudget };
};
const computeTodayHours = (businessHours) => {
    if (!businessHours) {
        return { isOpenToday: true, todayHours: "8:00 AM - 6:00 PM" };
    }
    const daysOfWeek = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
    ];
    const todayName = daysOfWeek[new Date().getDay()];
    if (businessHours.mode === "customize" && businessHours.days) {
        const todayConfig = businessHours.days[todayName];
        if (todayConfig) {
            const isOpen = todayConfig.isOpen !== false;
            return {
                isOpenToday: isOpen,
                todayHours: isOpen
                    ? `${todayConfig.openTime || "8:00 AM"} - ${todayConfig.closeTime || "6:00 PM"}`
                    : "Closed",
            };
        }
    }
    const allDays = businessHours.allDays;
    const isOpen = (allDays === null || allDays === void 0 ? void 0 : allDays.isOpen) !== false;
    return {
        isOpenToday: isOpen,
        todayHours: isOpen
            ? `${(allDays === null || allDays === void 0 ? void 0 : allDays.openTime) || "8:00 AM"} - ${(allDays === null || allDays === void 0 ? void 0 : allDays.closeTime) || "6:00 PM"}`
            : "Closed",
    };
};
const buildCategoryTabs = (items) => {
    const categoryMap = new Map();
    for (const item of items) {
        const cat = item.category;
        if (!cat || typeof cat !== "object" || !cat._id) {
            continue;
        }
        const key = cat._id.toString();
        const existing = categoryMap.get(key);
        if (existing) {
            existing.count += 1;
        }
        else {
            categoryMap.set(key, {
                _id: cat._id,
                name: cat.name,
                icon: cat.icon,
                coverImage: cat.coverImage,
                count: 1,
            });
        }
    }
    return Array.from(categoryMap.values());
};
const getAllProfessionalsFromDB = (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (query = {}, currentUserId) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    const rawCategoryId = (query.category || query.categoryId);
    const categoryParam = rawCategoryId === null || rawCategoryId === void 0 ? void 0 : rawCategoryId.trim();
    let targetCategoryId = null;
    if (categoryParam &&
        categoryParam.toLowerCase() !== "all" &&
        categoryParam.toLowerCase() !== "all services") {
        if (mongoose_1.default.Types.ObjectId.isValid(categoryParam)) {
            targetCategoryId = new mongoose_1.default.Types.ObjectId(categoryParam);
        }
        else {
            const matchedCategory = yield category_model_1.Category.findOne({
                name: new RegExp(`^${(0, searchHelper_1.escapeRegex)(categoryParam)}$`, "i"),
                isDeleted: { $ne: true },
            }).lean();
            if (matchedCategory) {
                targetCategoryId = matchedCategory._id;
            }
        }
    }
    const searchTerm = (_a = ((query.searchTerm || query.search))) === null || _a === void 0 ? void 0 : _a.trim();
    const locationQuery = (_b = ((query.location || query.city || query.state || query.zipCode))) === null || _b === void 0 ? void 0 : _b.trim();
    let userLat;
    let userLng;
    const rawLat = (_c = query.latitude) !== null && _c !== void 0 ? _c : query.lat;
    const rawLng = (_d = query.longitude) !== null && _d !== void 0 ? _d : query.lng;
    if (rawLat !== undefined && rawLat !== null && rawLat !== "") {
        const parsed = Number(rawLat);
        if (!isNaN(parsed))
            userLat = parsed;
    }
    if (rawLng !== undefined && rawLng !== null && rawLng !== "") {
        const parsed = Number(rawLng);
        if (!isNaN(parsed))
            userLng = parsed;
    }
    // If coordinates are not provided in query, retrieve from logged-in user's profile
    if ((userLat === undefined || userLng === undefined) && currentUserId) {
        const currentUser = yield user_model_1.User.findById(currentUserId)
            .select("location")
            .lean();
        const userCoords = (_e = currentUser === null || currentUser === void 0 ? void 0 : currentUser.location) === null || _e === void 0 ? void 0 : _e.coordinates;
        if (Array.isArray(userCoords) &&
            userCoords.length === 2 &&
            (userCoords[0] !== 0 || userCoords[1] !== 0)) {
            userLng = userCoords[0];
            userLat = userCoords[1];
        }
    }
    const hasUserCoords = userLat !== undefined &&
        userLng !== undefined &&
        !isNaN(userLat) &&
        !isNaN(userLng);
    const radiusParam = (_f = query.radius) !== null && _f !== void 0 ? _f : query.maxDistance;
    const maxDistanceInMiles = radiusParam !== undefined && radiusParam !== null && radiusParam !== ""
        ? Number(radiusParam)
        : undefined;
    const { minBudget, maxBudget } = parseBudgetFilter(query);
    const rawRating = (_g = query.minRating) !== null && _g !== void 0 ? _g : query.rating;
    const minRating = rawRating !== undefined && rawRating !== null && rawRating !== ""
        ? Number(rawRating)
        : undefined;
    const sortBy = (_h = ((query.sortBy || query.sort))) === null || _h === void 0 ? void 0 : _h.toLowerCase().trim();
    // 1. Initial Match Stage for User
    const initialMatch = {
        role: user_1.USER_ROLES.PROFESSIONAL,
        status: user_1.STATUS.ACTIVE,
        approvalStatus: user_1.APPROVAL_STATUS.APPROVED,
        isDeleted: { $ne: true },
    };
    if (locationQuery) {
        const locRegex = new RegExp((0, searchHelper_1.escapeRegex)(locationQuery), "i");
        initialMatch.$or = [
            { city: locRegex },
            { state: locRegex },
            { zipCode: locRegex },
            { streetAddress: locRegex },
            { "location.address": locRegex },
        ];
    }
    const pipeline = [
        { $match: initialMatch },
        // Lookup primary category from Category collection
        {
            $lookup: {
                from: "categories",
                localField: "category",
                foreignField: "_id",
                as: "primaryCategory",
            },
        },
        {
            $unwind: {
                path: "$primaryCategory",
                preserveNullAndEmptyArrays: true,
            },
        },
        // Lookup professional's services
        {
            $lookup: {
                from: "services",
                let: { proId: "$_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: { $eq: ["$professional", "$$proId"] },
                            isDeleted: { $ne: true },
                        },
                    },
                    {
                        $lookup: {
                            from: "categories",
                            localField: "category",
                            foreignField: "_id",
                            as: "categoryObj",
                        },
                    },
                    {
                        $unwind: {
                            path: "$categoryObj",
                            preserveNullAndEmptyArrays: true,
                        },
                    },
                    {
                        $project: {
                            _id: 1,
                            name: 1,
                            description: 1,
                            category: {
                                $ifNull: ["$categoryObj", "$category"],
                            },
                        },
                    },
                ],
                as: "services",
            },
        },
        // Lookup review ratings
        {
            $lookup: {
                from: "reviews",
                let: { proId: "$_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $or: [
                                    { $eq: ["$professional", "$$proId"] },
                                    { $eq: ["$contractor", "$$proId"] },
                                ],
                            },
                        },
                    },
                    {
                        $group: {
                            _id: null,
                            totalReviews: { $sum: 1 },
                            averageRating: { $avg: "$rating" },
                        },
                    },
                ],
                as: "reviewStats",
            },
        },
        // Lookup completed jobs from jobrequests
        {
            $lookup: {
                from: "jobrequests",
                let: { proId: "$_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: { $eq: ["$professional", "$$proId"] },
                            status: jobRequest_1.JOB_REQUEST_STATUS.COMPLETED,
                            isDeleted: { $ne: true },
                        },
                    },
                    {
                        $count: "count",
                    },
                ],
                as: "jobStats",
            },
        },
        // Lookup completed bookings
        {
            $lookup: {
                from: "bookings",
                let: { proId: "$_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: { $eq: ["$professional", "$$proId"] },
                            status: booking_constant_1.BOOKING_STATUS.COMPLETED,
                            isDeleted: { $ne: true },
                        },
                    },
                    {
                        $count: "count",
                    },
                ],
                as: "bookingStats",
            },
        },
        // Add computed fields
        {
            $addFields: {
                averageRating: {
                    $round: [
                        {
                            $ifNull: [{ $arrayElemAt: ["$reviewStats.averageRating", 0] }, 0],
                        },
                        1,
                    ],
                },
                totalReviews: {
                    $ifNull: [{ $arrayElemAt: ["$reviewStats.totalReviews", 0] }, 0],
                },
                effectiveRate: {
                    $ifNull: ["$startingRate", { $ifNull: ["$hourlyRate", null] }],
                },
                actualCompletedJobs: {
                    $add: [
                        { $ifNull: [{ $arrayElemAt: ["$jobStats.count", 0] }, 0] },
                        { $ifNull: [{ $arrayElemAt: ["$bookingStats.count", 0] }, 0] },
                    ],
                },
            },
        },
    ];
    // Category filter
    if (targetCategoryId) {
        pipeline.push({
            $match: {
                $or: [
                    { "primaryCategory._id": targetCategoryId },
                    { "services.category._id": targetCategoryId },
                    { "services.category": targetCategoryId },
                    { "projectPhotos.category": targetCategoryId },
                ],
            },
        });
    }
    // Search filter
    if (searchTerm) {
        const sRegex = new RegExp((0, searchHelper_1.escapeRegex)(searchTerm), "i");
        pipeline.push({
            $match: {
                $or: [
                    { name: sRegex },
                    { companyName: sRegex },
                    { about: sRegex },
                    { "primaryCategory.name": sRegex },
                    { "services.name": sRegex },
                    { "services.description": sRegex },
                ],
            },
        });
    }
    // Budget filter
    const budgetMatch = {};
    if (minBudget !== undefined && !isNaN(minBudget)) {
        budgetMatch.$gte = minBudget;
    }
    if (maxBudget !== undefined && !isNaN(maxBudget)) {
        budgetMatch.$lte = maxBudget;
    }
    if (Object.keys(budgetMatch).length > 0) {
        pipeline.push({
            $match: { effectiveRate: budgetMatch },
        });
    }
    // Min rating filter
    if (minRating !== undefined && !isNaN(minRating)) {
        pipeline.push({
            $match: { averageRating: { $gte: minRating } },
        });
    }
    // Project fields
    pipeline.push({
        $project: {
            _id: 1,
            name: 1,
            companyName: 1,
            profileImage: 1,
            verified: 1,
            isBackgroundVerified: { $ifNull: ["$backgroundCheck.passed", false] },
            isLicenseVerified: { $ifNull: ["$tradeLicense.isVerified", false] },
            isInsuranceVerified: {
                $ifNull: ["$liabilityInsurance.isVerified", false],
            },
            city: 1,
            state: 1,
            zipCode: 1,
            streetAddress: 1,
            location: 1,
            about: 1,
            yearsOfExperience: { $ifNull: ["$yearsOfExperience", ""] },
            serviceRadiusInMiles: 1,
            businessHours: 1,
            acceptedPayments: 1,
            projectPhotos: 1,
            startingRate: "$effectiveRate",
            startingEstimate: "$effectiveRate",
            startingPrice: "$effectiveRate",
            hourlyRate: {
                $ifNull: ["$hourlyRate", { $ifNull: ["$effectiveRate", null] }],
            },
            completedJobs: {
                $cond: {
                    if: { $gt: ["$completedJobs", 0] },
                    then: "$completedJobs",
                    else: { $ifNull: ["$actualCompletedJobs", 0] },
                },
            },
            localJobs: { $ifNull: ["$localJobs", 0] },
            responseTime: { $ifNull: ["$responseTime", ""] },
            availability: { $ifNull: ["$availability", ""] },
            averageRating: 1,
            totalReviews: 1,
            category: "$primaryCategory",
            serviceCount: { $size: "$services" },
            services: 1,
            createdAt: 1,
        },
    });
    // Sort stage
    let sortStage = {
        averageRating: -1,
        totalReviews: -1,
        completedJobs: -1,
        createdAt: -1,
    };
    if (sortBy === "highest_rated" ||
        sortBy === "rating" ||
        sortBy === "-rating" ||
        sortBy === "top_rated" ||
        sortBy === "top-rated") {
        sortStage = {
            averageRating: -1,
            totalReviews: -1,
            completedJobs: -1,
            createdAt: -1,
        };
    }
    else if (sortBy === "most_reviewed" ||
        sortBy === "reviews" ||
        sortBy === "-reviews") {
        sortStage = { totalReviews: -1, averageRating: -1, createdAt: -1 };
    }
    else if (sortBy === "price_low_to_high" ||
        sortBy === "price_asc" ||
        sortBy === "budget_asc" ||
        sortBy === "low_to_high") {
        sortStage = { startingRate: 1, averageRating: -1, createdAt: -1 };
    }
    else if (sortBy === "price_high_to_low" ||
        sortBy === "price_desc" ||
        sortBy === "budget_desc" ||
        sortBy === "high_to_low") {
        sortStage = { startingRate: -1, averageRating: -1, createdAt: -1 };
    }
    else if (sortBy === "newest" || sortBy === "created_at") {
        sortStage = { createdAt: -1, _id: 1 };
    }
    pipeline.push({ $sort: sortStage });
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 10);
    const skip = (page - 1) * limit;
    pipeline.push({
        $facet: {
            data: [{ $skip: skip }, { $limit: limit }],
            totalCount: [{ $count: "total" }],
        },
    });
    const [aggregateResult] = yield user_model_1.User.aggregate(pipeline);
    const rawData = (aggregateResult === null || aggregateResult === void 0 ? void 0 : aggregateResult.data) || [];
    const total = ((_k = (_j = aggregateResult === null || aggregateResult === void 0 ? void 0 : aggregateResult.totalCount) === null || _j === void 0 ? void 0 : _j[0]) === null || _k === void 0 ? void 0 : _k.total) || 0;
    const totalPage = Math.ceil(total / limit);
    // Compute favorite status
    const professionalIds = rawData.map((item) => item._id);
    const favoriteSet = currentUserId
        ? yield favorite_service_1.FavoriteService.getFavoriteProfessionalIds(currentUserId, professionalIds)
        : new Set();
    // Calculate Google Maps Distance Matrix
    let distanceMap = new Map();
    if (hasUserCoords) {
        const destinations = rawData
            .filter((item) => {
            var _a;
            const coords = (_a = item.location) === null || _a === void 0 ? void 0 : _a.coordinates;
            return (Array.isArray(coords) &&
                coords.length === 2 &&
                (coords[0] !== 0 || coords[1] !== 0));
        })
            .map((item) => ({
            id: item._id.toString(),
            lat: item.location.coordinates[1],
            lng: item.location.coordinates[0],
        }));
        if (destinations.length > 0) {
            distanceMap = yield (0, googleMapsHelper_1.getBatchGoogleDistances)({ lat: userLat, lng: userLng }, destinations);
        }
    }
    // Enrich data for UI cards
    let enrichedData = rawData.map((item) => {
        var _a, _b, _c;
        let distanceInMiles = null;
        let distanceFormatted = null;
        let durationFormatted = null;
        if (hasUserCoords) {
            const distInfo = distanceMap.get(item._id.toString());
            if (distInfo) {
                distanceInMiles = distInfo.distanceInMiles;
                distanceFormatted = distInfo.distanceFormatted;
                durationFormatted = distInfo.durationText || null;
            }
        }
        const coverImage = item.profileImage ||
            ((_b = (_a = item.projectPhotos) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.image) ||
            ((_c = item.category) === null || _c === void 0 ? void 0 : _c.coverImage) ||
            "";
        const locationFormatted = `${item.city || ""}${item.city && item.state ? ", " : ""}${item.state || ""}`;
        return Object.assign(Object.assign({}, item), { coverImage, thumbnail: coverImage, locationFormatted,
            distanceInMiles,
            distanceFormatted,
            durationFormatted, hiredCount: item.completedJobs, totalJobs: item.completedJobs, isFavorite: favoriteSet.has(item._id.toString()) });
    });
    // Filter by distance radius if specified
    if (hasUserCoords &&
        maxDistanceInMiles !== undefined &&
        !isNaN(maxDistanceInMiles)) {
        enrichedData = enrichedData.filter((item) => item.distanceInMiles !== null &&
            item.distanceInMiles <= maxDistanceInMiles);
    }
    // If sort was distance
    if (sortBy === "distance" || sortBy === "nearest") {
        enrichedData.sort((a, b) => {
            var _a, _b;
            const distA = (_a = a.distanceInMiles) !== null && _a !== void 0 ? _a : Number.MAX_SAFE_INTEGER;
            const distB = (_b = b.distanceInMiles) !== null && _b !== void 0 ? _b : Number.MAX_SAFE_INTEGER;
            return distA - distB;
        });
    }
    return {
        data: enrichedData,
        meta: {
            page,
            limit,
            total,
            totalPage,
        },
    };
});
const getProfessionalDetailsFromDB = (professionalId, currentUserId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    assertValidObjectId(professionalId, "professional");
    const professional = yield user_model_1.User.findOne({
        _id: professionalId,
        role: user_1.USER_ROLES.PROFESSIONAL,
        status: user_1.STATUS.ACTIVE,
        approvalStatus: user_1.APPROVAL_STATUS.APPROVED,
    })
        .select("name companyName profileImage verified category about yearsOfExperience serviceRadiusInMiles city state zipCode streetAddress location timezone businessHours acceptedPayments projectPhotos backgroundCheck.passed tradeLicense.isVerified liabilityInsurance.isVerified startingRate hourlyRate completedJobs localJobs responseTime availability createdAt")
        .populate("category", "name icon coverImage")
        .populate("projectPhotos.category", "name icon coverImage")
        .lean();
    if (!professional) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Professional not found");
    }
    const [services, reviewSummary, reviews, isFavorite, completedJobRequestsCount, completedBookingsCount,] = yield Promise.all([
        service_model_1.Service.find({ professional: professionalId, isDeleted: { $ne: true } })
            .populate("category", "name icon coverImage")
            .sort({ createdAt: -1 })
            .lean(),
        review_model_1.Review.calculateAverageRating(professionalId),
        review_model_1.Review.find({
            $or: [
                { contractor: professionalId },
                { professional: professionalId },
            ],
        })
            .populate({
            path: "homeowner",
            select: "name profileImage city state",
        })
            .populate({
            path: "tenant",
            select: "name profileImage city state",
        })
            .populate({
            path: "professional",
            select: "name companyName profileImage",
        })
            .populate({
            path: "contractor",
            select: "name companyName profileImage",
        })
            .sort({ createdAt: -1 })
            .lean(),
        currentUserId
            ? favorite_service_1.FavoriteService.isFavorite(currentUserId, professionalId)
            : Promise.resolve(false),
        jobRequest_model_1.JobRequest.countDocuments({
            professional: professionalId,
            status: jobRequest_1.JOB_REQUEST_STATUS.COMPLETED,
            isDeleted: { $ne: true },
        }),
        booking_model_1.Booking.countDocuments({
            professional: professionalId,
            status: booking_constant_1.BOOKING_STATUS.COMPLETED,
            isDeleted: { $ne: true },
        }),
    ]);
    const formattedReviews = (reviews || []).map((r) => {
        const client = r.homeowner || r.tenant;
        const pro = r.professional || r.contractor;
        delete r.tenant;
        delete r.contractor;
        delete r.maintenance;
        return Object.assign(Object.assign({}, r), { homeowner: client, professional: pro, isReplied: Boolean(r.isReplied || (r.reply && r.reply.trim().length > 0)), reply: r.reply || null, repliedAt: r.repliedAt || null });
    });
    const projectPhotos = professional.projectPhotos || [];
    const hoursInfo = computeTodayHours(professional.businessHours);
    const startingRate = (_b = (_a = professional.startingRate) !== null && _a !== void 0 ? _a : professional.hourlyRate) !== null && _b !== void 0 ? _b : null;
    const actualCompletedJobsCount = completedJobRequestsCount + completedBookingsCount;
    const completedJobs = professional.completedJobs ||
        (actualCompletedJobsCount > 0 ? actualCompletedJobsCount : 0);
    const localJobs = professional.localJobs || 0;
    const coverImage = professional.profileImage ||
        ((_c = projectPhotos[0]) === null || _c === void 0 ? void 0 : _c.image) ||
        ((_d = professional.category) === null || _d === void 0 ? void 0 : _d.coverImage) ||
        "";
    const locationFormatted = [professional.city, professional.state]
        .filter(Boolean)
        .join(", ");
    // Calculate distance between current user and this professional via Google Maps
    let distanceInMiles = null;
    let distanceFormatted = null;
    let durationFormatted = null;
    if (currentUserId && ((_e = professional.location) === null || _e === void 0 ? void 0 : _e.coordinates)) {
        const currentUser = yield user_model_1.User.findById(currentUserId)
            .select("location")
            .lean();
        const userCoords = (_f = currentUser === null || currentUser === void 0 ? void 0 : currentUser.location) === null || _f === void 0 ? void 0 : _f.coordinates;
        const proCoords = professional.location.coordinates;
        if (Array.isArray(userCoords) &&
            userCoords.length === 2 &&
            (userCoords[0] !== 0 || userCoords[1] !== 0) &&
            Array.isArray(proCoords) &&
            proCoords.length === 2 &&
            (proCoords[0] !== 0 || proCoords[1] !== 0)) {
            const distMap = yield (0, googleMapsHelper_1.getBatchGoogleDistances)({ lat: userCoords[1], lng: userCoords[0] }, [
                {
                    id: professional._id.toString(),
                    lat: proCoords[1],
                    lng: proCoords[0],
                },
            ]);
            const distInfo = distMap.get(professional._id.toString());
            if (distInfo) {
                distanceInMiles = distInfo.distanceInMiles;
                distanceFormatted = distInfo.distanceFormatted;
                durationFormatted = distInfo.durationText || null;
            }
        }
    }
    return {
        _id: professional._id,
        name: professional.name,
        companyName: professional.companyName,
        profileImage: professional.profileImage,
        coverImage,
        thumbnail: coverImage,
        verified: professional.verified,
        isBackgroundVerified: Boolean((_g = professional.backgroundCheck) === null || _g === void 0 ? void 0 : _g.passed),
        isLicenseVerified: Boolean((_h = professional.tradeLicense) === null || _h === void 0 ? void 0 : _h.isVerified),
        isInsuranceVerified: Boolean((_j = professional.liabilityInsurance) === null || _j === void 0 ? void 0 : _j.isVerified),
        category: professional.category || null,
        about: professional.about || "",
        yearsOfExperience: professional.yearsOfExperience || "",
        serviceRadiusInMiles: (_k = professional.serviceRadiusInMiles) !== null && _k !== void 0 ? _k : null,
        city: professional.city || "",
        state: professional.state || "",
        zipCode: professional.zipCode || "",
        streetAddress: professional.streetAddress || "",
        location: professional.location || null,
        locationFormatted,
        distanceInMiles,
        distanceFormatted,
        durationFormatted,
        timezone: professional.timezone || "",
        businessHours: professional.businessHours || null,
        isOpenToday: hoursInfo.isOpenToday,
        todayHours: hoursInfo.todayHours,
        acceptedPayments: professional.acceptedPayments || [],
        startingRate,
        startingEstimate: startingRate,
        startingPrice: startingRate,
        hourlyRate: (_l = professional.hourlyRate) !== null && _l !== void 0 ? _l : startingRate,
        completedJobs,
        hiredCount: completedJobs,
        localJobs,
        responseTime: professional.responseTime || "",
        availability: professional.availability || "",
        averageRating: reviewSummary.averageRating,
        totalReviews: reviewSummary.totalReviews,
        recommendationRate: reviewSummary.recommendationRate || 100,
        recommendationPercentage: reviewSummary.recommendationPercentage || 100,
        ratingDistribution: reviewSummary.ratingDistribution,
        ratingBreakdown: reviewSummary.ratingBreakdown,
        serviceCount: services.length,
        services,
        photoCount: projectPhotos.length,
        categories: buildCategoryTabs([...services, ...projectPhotos]),
        projectPhotos,
        reviews: formattedReviews,
        isFavorite,
        createdAt: professional.createdAt,
    };
});
const getTopRatedProfessionalsFromDB = (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (query = {}, currentUserId) {
    const limitParam = query.limit;
    let parsedLimit = 8;
    if (limitParam !== undefined && limitParam !== null && limitParam !== "") {
        const num = Number(limitParam);
        if (!isNaN(num) && num > 0) {
            parsedLimit = num;
        }
    }
    const topRatedQuery = Object.assign(Object.assign({}, query), { limit: parsedLimit, sortBy: "highest_rated" });
    return getAllProfessionalsFromDB(topRatedQuery, currentUserId);
});
const ANALYTICS_MONTH_NAMES = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
];
const normalizeAnalyticsPeriod = (period) => {
    if (typeof period !== "string")
        return "this_year";
    const cleaned = period.trim().toLowerCase().replace(/[\s-]+/g, "_");
    if (cleaned === "this_month" ||
        cleaned === "thismonth" ||
        cleaned === "month" ||
        cleaned === "current_month") {
        return "this_month";
    }
    if (cleaned === "all_time" ||
        cleaned === "alltime" ||
        cleaned === "all" ||
        cleaned === "lifetime") {
        return "all_time";
    }
    return "this_year";
};
const formatAnalyticsHistoryDate = (date) => {
    if (!date)
        return "";
    const d = new Date(date);
    if (isNaN(d.getTime()))
        return "";
    return `${ANALYTICS_MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};
const getBookingEffectiveDate = (booking) => {
    const rawDate = booking.paidAt ||
        booking.homeownerCompletedAt ||
        booking.contractorCompletedAt ||
        booking.appointmentDate ||
        booking.createdAt;
    const d = new Date(rawDate);
    return isNaN(d.getTime()) ? new Date() : d;
};
const getProfessionalAnalyticsFromDB = (professionalId_1, ...args_1) => __awaiter(void 0, [professionalId_1, ...args_1], void 0, function* (professionalId, query = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    assertValidObjectId(professionalId, "professional");
    const professionalObjectId = new mongoose_1.default.Types.ObjectId(professionalId);
    // Verify professional exists
    const professional = yield user_model_1.User.findById(professionalObjectId).lean();
    if (!professional) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Professional not found");
    }
    const period = normalizeAnalyticsPeriod(query.period);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0 to 11
    const parsedYear = Number(query.year);
    const selectedYear = !isNaN(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100
        ? parsedYear
        : currentYear;
    const parsedMonth = Number(query.month);
    const selectedMonth = !isNaN(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12
        ? parsedMonth - 1
        : currentMonth;
    // Determine period date ranges
    let startDate;
    let endDate;
    let prevStartDate = null;
    let prevEndDate = null;
    if (period === "this_month") {
        startDate = new Date(selectedYear, selectedMonth, 1, 0, 0, 0, 0);
        endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);
        prevStartDate = new Date(selectedYear, selectedMonth - 1, 1, 0, 0, 0, 0);
        prevEndDate = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999);
    }
    else if (period === "this_year") {
        startDate = new Date(selectedYear, 0, 1, 0, 0, 0, 0);
        endDate = new Date(selectedYear, 11, 31, 23, 59, 59, 999);
        prevStartDate = new Date(selectedYear - 1, 0, 1, 0, 0, 0, 0);
        prevEndDate = new Date(selectedYear - 1, 11, 31, 23, 59, 59, 999);
    }
    else {
        // all_time
        startDate = new Date(0);
        endDate = new Date(selectedYear + 10, 11, 31, 23, 59, 59, 999);
        prevStartDate = null;
        prevEndDate = null;
    }
    // Find all completed or settled bookings for this professional
    const completedFilter = {
        professional: professionalObjectId,
        isDeleted: { $ne: true },
        status: { $ne: booking_constant_1.BOOKING_STATUS.CANCELLED },
        $or: [
            { status: booking_constant_1.BOOKING_STATUS.COMPLETED },
            { paymentStatus: "paid" },
            { homeownerCompletedAt: { $ne: null } },
            { contractorCompletedAt: { $ne: null } },
        ],
    };
    const [allCompletedBookings, overallReviewSummary, periodReviewStats] = yield Promise.all([
        booking_model_1.Booking.find(completedFilter)
            .populate({
            path: "jobRequest",
            select: "headline title description category serviceLocation",
            populate: { path: "category", select: "name icon" },
        })
            .populate("homeowner", "name email profileImage phone")
            .lean(),
        review_model_1.Review.calculateAverageRating(professionalObjectId),
        review_model_1.Review.aggregate([
            {
                $match: Object.assign({ $or: [
                        { professional: professionalObjectId },
                        { contractor: professionalObjectId },
                    ] }, (period !== "all_time"
                    ? { createdAt: { $gte: startDate, $lte: endDate } }
                    : {})),
            },
            {
                $group: {
                    _id: null,
                    totalReviews: { $sum: 1 },
                    averageRating: { $avg: "$rating" },
                },
            },
        ]),
    ]);
    // Current period bookings
    const currentPeriodBookings = allCompletedBookings.filter((b) => {
        const d = getBookingEffectiveDate(b);
        return d >= startDate && d <= endDate;
    });
    const currentPeriodEarnings = currentPeriodBookings.reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0);
    // Previous period earnings (for growth comparison)
    let prevPeriodEarnings = 0;
    if (prevStartDate && prevEndDate) {
        const prevPeriodBookings = allCompletedBookings.filter((b) => {
            const d = getBookingEffectiveDate(b);
            return d >= prevStartDate && d <= prevEndDate;
        });
        prevPeriodEarnings = prevPeriodBookings.reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0);
    }
    // Earnings growth calculation
    let earningsGrowth = 0;
    let earningsGrowthFormatted = "+0.0%";
    if (prevPeriodEarnings > 0) {
        earningsGrowth =
            Math.round(((currentPeriodEarnings - prevPeriodEarnings) / prevPeriodEarnings) *
                100 *
                10) / 10;
        earningsGrowthFormatted =
            earningsGrowth >= 0 ? `+${earningsGrowth}%` : `${earningsGrowth}%`;
    }
    else if (currentPeriodEarnings > 0) {
        earningsGrowth = 100;
        earningsGrowthFormatted = "+100%";
    }
    else {
        earningsGrowth = 0;
        earningsGrowthFormatted = "0%";
    }
    // Current period unique clients
    const currentPeriodClientIds = new Set();
    for (const b of currentPeriodBookings) {
        const hId = ((_b = (_a = b.homeowner) === null || _a === void 0 ? void 0 : _a._id) === null || _b === void 0 ? void 0 : _b.toString()) ||
            ((_c = b.homeowner) === null || _c === void 0 ? void 0 : _c.toString());
        if (hId)
            currentPeriodClientIds.add(hId);
    }
    // Rating & review computation
    const overallRating = (overallReviewSummary === null || overallReviewSummary === void 0 ? void 0 : overallReviewSummary.averageRating) || 0;
    const overallTotalReviews = (overallReviewSummary === null || overallReviewSummary === void 0 ? void 0 : overallReviewSummary.totalReviews) || 0;
    const periodAvgRating = periodReviewStats.length > 0 && periodReviewStats[0].averageRating != null
        ? Math.round(periodReviewStats[0].averageRating * 10) / 10
        : 0;
    const periodTotalReviews = periodReviewStats.length > 0 && periodReviewStats[0].totalReviews != null
        ? periodReviewStats[0].totalReviews
        : 0;
    const displayRating = periodTotalReviews > 0 ? periodAvgRating : overallRating;
    const displayReviews = period === "all_time"
        ? overallTotalReviews
        : periodTotalReviews > 0
            ? periodTotalReviews
            : overallTotalReviews;
    // Monthly income overview & Clients & Work Volume (12 months)
    const monthlyIncomeOverview = [];
    const clientsAndWorkVolume = [];
    for (let m = 0; m < 12; m++) {
        let matchedMonthBookings = [];
        if (period === "this_month") {
            // For this_month, highlight the selected month
            if (m === selectedMonth) {
                matchedMonthBookings = allCompletedBookings.filter((b) => {
                    const d = getBookingEffectiveDate(b);
                    return (d.getFullYear() === selectedYear && d.getMonth() === selectedMonth);
                });
            }
            else {
                matchedMonthBookings = [];
            }
        }
        else if (period === "this_year") {
            matchedMonthBookings = allCompletedBookings.filter((b) => {
                const d = getBookingEffectiveDate(b);
                return d.getFullYear() === selectedYear && d.getMonth() === m;
            });
        }
        else {
            // all_time: cumulative across all time for this calendar month
            matchedMonthBookings = allCompletedBookings.filter((b) => {
                const d = getBookingEffectiveDate(b);
                return d.getMonth() === m;
            });
        }
        const monthIncome = matchedMonthBookings.reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0);
        const roundedIncome = Math.round(monthIncome * 100) / 100;
        const monthClients = new Set();
        for (const b of matchedMonthBookings) {
            const hId = ((_e = (_d = b.homeowner) === null || _d === void 0 ? void 0 : _d._id) === null || _e === void 0 ? void 0 : _e.toString()) ||
                ((_f = b.homeowner) === null || _f === void 0 ? void 0 : _f.toString());
            if (hId)
                monthClients.add(hId);
        }
        const jobsCount = matchedMonthBookings.length;
        const clientsCount = monthClients.size;
        monthlyIncomeOverview.push({
            month: ANALYTICS_MONTH_NAMES[m],
            monthNumber: m + 1,
            year: selectedYear,
            income: roundedIncome,
            formattedIncome: `$${roundedIncome.toLocaleString("en-US")}`,
            isSelected: period === "this_month" && m === selectedMonth,
        });
        clientsAndWorkVolume.push({
            month: ANALYTICS_MONTH_NAMES[m],
            monthNumber: m + 1,
            year: selectedYear,
            clients: clientsCount,
            jobs: jobsCount,
            volume: jobsCount,
            formatted: `${clientsCount} clients • ${jobsCount} jobs`,
            isSelected: period === "this_month" && m === selectedMonth,
        });
    }
    // Daily breakdown when period is this_month
    let dailyIncomeOverview;
    if (period === "this_month") {
        dailyIncomeOverview = [];
        const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
        for (let d = 1; d <= daysInMonth; d++) {
            const dayBookings = allCompletedBookings.filter((b) => {
                const date = getBookingEffectiveDate(b);
                return (date.getFullYear() === selectedYear &&
                    date.getMonth() === selectedMonth &&
                    date.getDate() === d);
            });
            const dayIncome = dayBookings.reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0);
            const dayClients = new Set();
            for (const b of dayBookings) {
                const hId = ((_h = (_g = b.homeowner) === null || _g === void 0 ? void 0 : _g._id) === null || _h === void 0 ? void 0 : _h.toString()) ||
                    ((_j = b.homeowner) === null || _j === void 0 ? void 0 : _j.toString());
                if (hId)
                    dayClients.add(hId);
            }
            const dayPadded = String(d).padStart(2, "0");
            const monthPadded = String(selectedMonth + 1).padStart(2, "0");
            const roundedDayIncome = Math.round(dayIncome * 100) / 100;
            dailyIncomeOverview.push({
                day: d,
                date: `${selectedYear}-${monthPadded}-${dayPadded}`,
                income: roundedDayIncome,
                formattedIncome: `$${roundedDayIncome.toLocaleString("en-US")}`,
                jobs: dayBookings.length,
                clients: dayClients.size,
            });
        }
    }
    // History list from current period
    let historySource = [...currentPeriodBookings];
    // Optional search in history
    const searchTerm = (query.searchTerm || query.search);
    if (searchTerm && typeof searchTerm === "string" && searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        historySource = historySource.filter((b) => {
            var _a, _b, _c;
            const clientName = (((_a = b.homeowner) === null || _a === void 0 ? void 0 : _a.name) || "").toLowerCase();
            const serviceTitle = (((_b = b.jobRequest) === null || _b === void 0 ? void 0 : _b.headline) ||
                ((_c = b.jobRequest) === null || _c === void 0 ? void 0 : _c.title) ||
                "").toLowerCase();
            const paymentMethod = (b.settledPaymentMethod ||
                b.paymentMethod ||
                "").toLowerCase();
            return (clientName.includes(term) ||
                serviceTitle.includes(term) ||
                paymentMethod.includes(term));
        });
    }
    // Sort history descending by effective date
    historySource.sort((a, b) => {
        const dateA = getBookingEffectiveDate(a).getTime();
        const dateB = getBookingEffectiveDate(b).getTime();
        return dateB - dateA;
    });
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 10);
    const totalHistory = historySource.length;
    const totalPage = Math.ceil(totalHistory / limit) || 1;
    const paginatedBookings = historySource.slice((page - 1) * limit, page * limit);
    const periodLabel = period === "this_month"
        ? "This Month"
        : period === "this_year"
            ? "This Year"
            : "All Time";
    const roundedEarnings = Math.round(currentPeriodEarnings * 100) / 100;
    return {
        period,
        periodLabel,
        year: selectedYear,
        selectedMonth: selectedMonth + 1,
        stats: {
            earnings: roundedEarnings,
            earningsFormatted: `$${roundedEarnings.toLocaleString("en-US")}`,
            earningsGrowth,
            earningsGrowthFormatted,
            completedJobs: currentPeriodBookings.length,
            clients: currentPeriodClientIds.size,
            rating: displayRating,
            totalReviews: displayReviews,
            ratingDetails: {
                averageRating: overallRating,
                totalReviews: overallTotalReviews,
                periodRating: periodAvgRating,
                periodReviews: periodTotalReviews,
                overallRating,
                overallReviews: overallTotalReviews,
            },
        },
        monthlyIncomeOverview,
        clientsAndWorkVolume,
        clientAndWorkVolume: clientsAndWorkVolume,
        dailyIncomeOverview,
    };
});
const getProfessionalHistoryFromDB = (professionalId_1, ...args_1) => __awaiter(void 0, [professionalId_1, ...args_1], void 0, function* (professionalId, query = {}) {
    assertValidObjectId(professionalId, "professional");
    const professionalObjectId = new mongoose_1.default.Types.ObjectId(professionalId);
    const professional = yield user_model_1.User.findById(professionalObjectId).lean();
    if (!professional) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Professional not found");
    }
    const period = normalizeAnalyticsPeriod(query.period);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const parsedYear = Number(query.year);
    const selectedYear = !isNaN(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100
        ? parsedYear
        : currentYear;
    const parsedMonth = Number(query.month);
    const selectedMonth = !isNaN(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12
        ? parsedMonth - 1
        : currentMonth;
    let startDate;
    let endDate;
    if (period === "this_month") {
        startDate = new Date(selectedYear, selectedMonth, 1, 0, 0, 0, 0);
        endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);
    }
    else if (period === "this_year") {
        startDate = new Date(selectedYear, 0, 1, 0, 0, 0, 0);
        endDate = new Date(selectedYear, 11, 31, 23, 59, 59, 999);
    }
    else {
        startDate = new Date(0);
        endDate = new Date(selectedYear + 10, 11, 31, 23, 59, 59, 999);
    }
    const completedFilter = {
        professional: professionalObjectId,
        isDeleted: { $ne: true },
        status: { $ne: booking_constant_1.BOOKING_STATUS.CANCELLED },
        $or: [
            { status: booking_constant_1.BOOKING_STATUS.COMPLETED },
            { paymentStatus: "paid" },
            { homeownerCompletedAt: { $ne: null } },
            { contractorCompletedAt: { $ne: null } },
        ],
    };
    const allCompletedBookings = yield booking_model_1.Booking.find(completedFilter)
        .populate({
        path: "jobRequest",
        select: "headline title description category serviceLocation",
        populate: { path: "category", select: "name icon" },
    })
        .populate("homeowner", "name email profileImage phone")
        .lean();
    let historySource = allCompletedBookings.filter((b) => {
        const d = getBookingEffectiveDate(b);
        return d >= startDate && d <= endDate;
    });
    const searchTerm = (query.searchTerm || query.search);
    if (searchTerm && typeof searchTerm === "string" && searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        historySource = historySource.filter((b) => {
            var _a, _b, _c;
            const clientName = (((_a = b.homeowner) === null || _a === void 0 ? void 0 : _a.name) || "").toLowerCase();
            const serviceTitle = (((_b = b.jobRequest) === null || _b === void 0 ? void 0 : _b.headline) ||
                ((_c = b.jobRequest) === null || _c === void 0 ? void 0 : _c.title) ||
                "").toLowerCase();
            const paymentMethod = (b.settledPaymentMethod ||
                b.paymentMethod ||
                "").toLowerCase();
            return (clientName.includes(term) ||
                serviceTitle.includes(term) ||
                paymentMethod.includes(term));
        });
    }
    historySource.sort((a, b) => {
        const dateA = getBookingEffectiveDate(a).getTime();
        const dateB = getBookingEffectiveDate(b).getTime();
        return dateB - dateA;
    });
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 10);
    const totalHistory = historySource.length;
    const totalPage = Math.ceil(totalHistory / limit) || 1;
    const paginatedBookings = historySource.slice((page - 1) * limit, page * limit);
    const historyData = paginatedBookings.map((b) => {
        var _a, _b, _c, _d;
        const effectiveDate = getBookingEffectiveDate(b);
        const homeowner = b.homeowner || {};
        const jobRequest = b.jobRequest || {};
        const totalAmount = Number(b.totalAmount) || 0;
        return {
            _id: ((_a = b._id) === null || _a === void 0 ? void 0 : _a.toString()) || "",
            bookingId: ((_b = b._id) === null || _b === void 0 ? void 0 : _b.toString()) || "",
            client: {
                _id: (_c = homeowner._id) === null || _c === void 0 ? void 0 : _c.toString(),
                name: homeowner.name || "Client",
                profileImage: homeowner.profileImage || "",
                email: homeowner.email || "",
                phone: homeowner.phone || "",
            },
            clientName: homeowner.name || "Client",
            clientImage: homeowner.profileImage || "",
            serviceTitle: jobRequest.headline || jobRequest.title || "Service",
            category: ((_d = jobRequest.category) === null || _d === void 0 ? void 0 : _d.name) || "",
            date: effectiveDate,
            formattedDate: formatAnalyticsHistoryDate(effectiveDate),
            amount: totalAmount,
            formattedAmount: `$${totalAmount.toLocaleString("en-US")}`,
            status: b.status || booking_constant_1.BOOKING_STATUS.COMPLETED,
            paymentMethod: b.settledPaymentMethod || b.paymentMethod || "Cash",
            paymentStatus: b.paymentStatus || "paid",
        };
    });
    return {
        meta: {
            page,
            limit,
            total: totalHistory,
            totalPage,
        },
        data: historyData,
    };
});
const getFileNameFromUrl = (url) => {
    if (!url)
        return null;
    const parts = url.split(/[/\\]/);
    return parts[parts.length - 1] || null;
};
const getBackgroundCheckStatusInfo = (bg) => {
    const isCleared = Boolean((bg === null || bg === void 0 ? void 0 : bg.passed) === true ||
        (bg === null || bg === void 0 ? void 0 : bg.status) === user_1.CHECKR_VERIFICATION_STATUS.VERIFIED);
    let statusLabel = "Not Started";
    if (isCleared) {
        statusLabel = "Cleared";
    }
    else if ((bg === null || bg === void 0 ? void 0 : bg.status) === user_1.CHECKR_VERIFICATION_STATUS.PENDING) {
        statusLabel = "Pending";
    }
    else if ((bg === null || bg === void 0 ? void 0 : bg.status) === user_1.CHECKR_VERIFICATION_STATUS.REVIEW_REQUIRED) {
        statusLabel = "Review Required";
    }
    else if ((bg === null || bg === void 0 ? void 0 : bg.status) === user_1.CHECKR_VERIFICATION_STATUS.FAILED) {
        statusLabel = "Failed";
    }
    else if (bg === null || bg === void 0 ? void 0 : bg.consentAccepted) {
        statusLabel = "Consent Accepted";
    }
    return {
        status: (bg === null || bg === void 0 ? void 0 : bg.status) || user_1.CHECKR_VERIFICATION_STATUS.NOT_STARTED,
        statusLabel,
        isCleared,
        provider: "Checkr",
        providerDescription: "Verified via Checkr screening",
        checkrInvitationUrl: (bg === null || bg === void 0 ? void 0 : bg.checkrInvitationUrl) || null,
        viewUrl: (bg === null || bg === void 0 ? void 0 : bg.checkrInvitationUrl) || null,
        passed: isCleared,
        verifiedAt: (bg === null || bg === void 0 ? void 0 : bg.verifiedAt) || null,
        notes: (bg === null || bg === void 0 ? void 0 : bg.notes) || null,
    };
};
const getTradeLicenseStatusInfo = (tl) => {
    const isVerified = Boolean(tl === null || tl === void 0 ? void 0 : tl.isVerified);
    let status = "Not Provided";
    if (isVerified) {
        status = "Verified & Active";
    }
    else if ((tl === null || tl === void 0 ? void 0 : tl.licenseNumber) || (tl === null || tl === void 0 ? void 0 : tl.certificateUrl)) {
        status = "Pending Verification";
    }
    return {
        licenseNumber: (tl === null || tl === void 0 ? void 0 : tl.licenseNumber) || "",
        state: (tl === null || tl === void 0 ? void 0 : tl.state) || "",
        issuingState: (tl === null || tl === void 0 ? void 0 : tl.state) || "",
        status,
        isVerified,
        certificateUrl: (tl === null || tl === void 0 ? void 0 : tl.certificateUrl) || null,
        fileName: getFileNameFromUrl(tl === null || tl === void 0 ? void 0 : tl.certificateUrl),
    };
};
const getLiabilityInsuranceStatusInfo = (li) => {
    const isVerified = Boolean(li === null || li === void 0 ? void 0 : li.isVerified);
    let status = "Not Provided";
    if (isVerified) {
        status = "Verified & Active";
    }
    else if ((li === null || li === void 0 ? void 0 : li.carrier) || (li === null || li === void 0 ? void 0 : li.certificateUrl)) {
        status = "Pending Verification";
    }
    const coverage = (li === null || li === void 0 ? void 0 : li.coverage) !== undefined && (li === null || li === void 0 ? void 0 : li.coverage) !== null
        ? String(li.coverage)
        : "";
    return {
        carrier: (li === null || li === void 0 ? void 0 : li.carrier) || "",
        coverage,
        coverageLimit: coverage,
        status,
        isVerified,
        expires: (li === null || li === void 0 ? void 0 : li.expires) || null,
        certificateUrl: (li === null || li === void 0 ? void 0 : li.certificateUrl) || null,
        fileName: getFileNameFromUrl(li === null || li === void 0 ? void 0 : li.certificateUrl),
    };
};
const getProfessionalApplicationFromDB = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    assertValidObjectId(userId, "user");
    const user = yield user_model_1.User.findById(userId)
        .select("approvalStatus rejectionReason tradeLicense liabilityInsurance backgroundCheck state")
        .lean();
    if (!user) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Professional not found");
    }
    return {
        approvalStatus: user.approvalStatus || user_1.APPROVAL_STATUS.PENDING,
        rejectionReason: user.rejectionReason || null,
        backgroundCheck: getBackgroundCheckStatusInfo(user.backgroundCheck),
        tradeLicense: getTradeLicenseStatusInfo(Object.assign(Object.assign({}, user.tradeLicense), { state: ((_a = user.tradeLicense) === null || _a === void 0 ? void 0 : _a.state) || user.state })),
        liabilityInsurance: getLiabilityInsuranceStatusInfo(user.liabilityInsurance),
    };
});
exports.ProfessionalService = {
    getAllProfessionalsFromDB,
    getTopRatedProfessionalsFromDB,
    getProfessionalDetailsFromDB,
    getProfessionalAnalyticsFromDB,
    getProfessionalHistoryFromDB,
    getProfessionalApplicationFromDB,
};
