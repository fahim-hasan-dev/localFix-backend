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
exports.FavoriteService = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const http_status_codes_1 = require("http-status-codes");
const ApiErrors_1 = __importDefault(require("../../../errors/ApiErrors"));
const review_model_1 = require("../review/review.model");
const user_model_1 = require("../user/user.model");
const favorite_model_1 = require("./favorite.model");
const assertValidObjectId = (id, label = "Reference") => {
    if (!id || !mongoose_1.default.Types.ObjectId.isValid(id)) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Invalid ${label} ID`);
    }
};
/**
 * Fast helper to check if a specific reference is favorited by a user.
 */
const isFavorite = (userId, referenceId) => __awaiter(void 0, void 0, void 0, function* () {
    if (!userId || !referenceId) {
        return false;
    }
    const exists = yield favorite_model_1.Favorite.exists({
        userId: new mongoose_1.Types.ObjectId(userId.toString()),
        referenceId: new mongoose_1.Types.ObjectId(referenceId.toString()),
    });
    return Boolean(exists);
});
/**
 * Fast helper to get a Set of favorited IDs for batch listings (e.g. professionals list).
 */
const getFavoriteProfessionalIds = (userId, professionalIds) => __awaiter(void 0, void 0, void 0, function* () {
    if (!userId || !professionalIds || !professionalIds.length) {
        return new Set();
    }
    const validIds = professionalIds
        .map((id) => id === null || id === void 0 ? void 0 : id.toString())
        .filter((id) => Boolean(id && mongoose_1.default.Types.ObjectId.isValid(id)))
        .map((id) => new mongoose_1.Types.ObjectId(id));
    if (!validIds.length) {
        return new Set();
    }
    const favorites = yield favorite_model_1.Favorite.find({
        userId: new mongoose_1.Types.ObjectId(userId.toString()),
        referenceId: { $in: validIds },
    })
        .select("referenceId")
        .lean();
    return new Set(favorites.map((fav) => fav.referenceId.toString()));
});
/**
 * Check favorite status for a single reference ID.
 */
const checkFavoriteStatus = (userId, referenceId) => __awaiter(void 0, void 0, void 0, function* () {
    assertValidObjectId(referenceId);
    const favorite = yield favorite_model_1.Favorite.exists({
        userId: new mongoose_1.Types.ObjectId(userId),
        referenceId: new mongoose_1.Types.ObjectId(referenceId),
    });
    return { isFavorite: Boolean(favorite) };
});
/**
 * Toggle favorite: add if not favorited, remove if already favorited.
 */
const toggleFavorite = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId, referenceId } = payload;
    assertValidObjectId(referenceId);
    if (userId.toString() === referenceId.toString()) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "You cannot favorite your own profile");
    }
    const targetUser = yield user_model_1.User.findById(referenceId)
        .select("_id name role status")
        .lean();
    if (!targetUser) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Target profile not found");
    }
    const existing = yield favorite_model_1.Favorite.findOne({
        userId: new mongoose_1.Types.ObjectId(userId),
        referenceId: new mongoose_1.Types.ObjectId(referenceId),
    });
    if (existing) {
        yield favorite_model_1.Favorite.deleteOne({ _id: existing._id });
        return {
            message: "Favorite removed successfully",
            isFavorite: false,
        };
    }
    const newFavorite = yield favorite_model_1.Favorite.create({
        userId: new mongoose_1.Types.ObjectId(userId),
        referenceId: new mongoose_1.Types.ObjectId(referenceId),
    });
    return {
        message: "Favorite added successfully",
        isFavorite: true,
        data: newFavorite,
    };
});
/**
 * Retrieve all favorites for a user, fully formatted with professional details & review ratings.
 */
const getFavorites = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const favorites = yield favorite_model_1.Favorite.find({
        userId: new mongoose_1.Types.ObjectId(userId),
    })
        .populate({
        path: "referenceId",
        select: "_id name companyName profileImage verified city state zipCode streetAddress location about yearsOfExperience serviceRadiusInMiles businessHours acceptedPayments projectPhotos backgroundCheck tradeLicense liabilityInsurance category createdAt role",
        populate: {
            path: "category",
            select: "_id name icon coverImage",
        },
    })
        .populate({
        path: "userId",
        select: "_id name email role profileImage",
    })
        .sort({ createdAt: -1 })
        .lean();
    if (!favorites.length) {
        return [];
    }
    // Filter out any favorites whose reference user has been deleted
    const validFavorites = favorites.filter((fav) => Boolean(fav.referenceId));
    const enrichedFavorites = yield Promise.all(validFavorites.map((fav) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e;
        const prof = fav.referenceId;
        const professionalId = (_a = prof._id) === null || _a === void 0 ? void 0 : _a.toString();
        let reviewSummary = {
            averageRating: 0,
            totalReviews: 0,
        };
        if (professionalId) {
            const stats = yield review_model_1.Review.calculateAverageRating(professionalId);
            reviewSummary = {
                averageRating: stats.averageRating,
                totalReviews: stats.totalReviews,
            };
        }
        const formattedProfessional = {
            _id: prof._id,
            name: prof.name,
            companyName: prof.companyName,
            profileImage: prof.profileImage,
            verified: prof.verified,
            isBackgroundVerified: Boolean((_b = prof.backgroundCheck) === null || _b === void 0 ? void 0 : _b.passed),
            isLicenseVerified: Boolean((_c = prof.tradeLicense) === null || _c === void 0 ? void 0 : _c.isVerified),
            isInsuranceVerified: Boolean((_d = prof.liabilityInsurance) === null || _d === void 0 ? void 0 : _d.isVerified),
            category: prof.category || null,
            city: prof.city || "",
            state: prof.state || "",
            zipCode: prof.zipCode || "",
            streetAddress: prof.streetAddress || "",
            location: prof.location || null,
            about: prof.about || "",
            yearsOfExperience: prof.yearsOfExperience || "",
            serviceRadiusInMiles: (_e = prof.serviceRadiusInMiles) !== null && _e !== void 0 ? _e : null,
            businessHours: prof.businessHours || null,
            acceptedPayments: prof.acceptedPayments || [],
            projectPhotos: prof.projectPhotos || [],
            averageRating: reviewSummary.averageRating,
            totalReviews: reviewSummary.totalReviews,
            isFavorite: true,
            createdAt: prof.createdAt,
        };
        return {
            _id: fav._id,
            userId: fav.userId,
            referenceId: prof._id,
            professional: formattedProfessional,
            isFavorite: true,
            createdAt: fav.createdAt,
            updatedAt: fav.updatedAt,
        };
    })));
    return enrichedFavorites;
});
/**
 * Retrieve a single favorite by favorite ID or reference ID.
 */
const getSingleFavorite = (userId, id) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    assertValidObjectId(id);
    const query = mongoose_1.default.Types.ObjectId.isValid(id)
        ? {
            userId: new mongoose_1.Types.ObjectId(userId),
            $or: [
                { _id: new mongoose_1.Types.ObjectId(id) },
                { referenceId: new mongoose_1.Types.ObjectId(id) },
            ],
        }
        : { _id: id, userId };
    const favorite = yield favorite_model_1.Favorite.findOne(query)
        .populate({
        path: "referenceId",
        select: "_id name companyName profileImage verified city state zipCode streetAddress location about yearsOfExperience serviceRadiusInMiles businessHours acceptedPayments projectPhotos backgroundCheck tradeLicense liabilityInsurance category createdAt role",
        populate: {
            path: "category",
            select: "_id name icon coverImage",
        },
    })
        .lean();
    if (!favorite) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Favorite not found");
    }
    const prof = favorite.referenceId;
    let reviewSummary = {
        averageRating: 0,
        totalReviews: 0,
    };
    if (prof === null || prof === void 0 ? void 0 : prof._id) {
        const stats = yield review_model_1.Review.calculateAverageRating(prof._id.toString());
        reviewSummary = {
            averageRating: stats.averageRating,
            totalReviews: stats.totalReviews,
        };
    }
    const formattedProfessional = prof
        ? {
            _id: prof._id,
            name: prof.name,
            companyName: prof.companyName,
            profileImage: prof.profileImage,
            verified: prof.verified,
            isBackgroundVerified: Boolean((_a = prof.backgroundCheck) === null || _a === void 0 ? void 0 : _a.passed),
            isLicenseVerified: Boolean((_b = prof.tradeLicense) === null || _b === void 0 ? void 0 : _b.isVerified),
            isInsuranceVerified: Boolean((_c = prof.liabilityInsurance) === null || _c === void 0 ? void 0 : _c.isVerified),
            category: prof.category || null,
            city: prof.city || "",
            state: prof.state || "",
            zipCode: prof.zipCode || "",
            streetAddress: prof.streetAddress || "",
            location: prof.location || null,
            about: prof.about || "",
            yearsOfExperience: prof.yearsOfExperience || "",
            serviceRadiusInMiles: (_d = prof.serviceRadiusInMiles) !== null && _d !== void 0 ? _d : null,
            businessHours: prof.businessHours || null,
            acceptedPayments: prof.acceptedPayments || [],
            projectPhotos: prof.projectPhotos || [],
            averageRating: reviewSummary.averageRating,
            totalReviews: reviewSummary.totalReviews,
            isFavorite: true,
            createdAt: prof.createdAt,
        }
        : null;
    return {
        _id: favorite._id,
        userId: favorite.userId,
        referenceId: (prof === null || prof === void 0 ? void 0 : prof._id) || favorite.referenceId,
        professional: formattedProfessional,
        isFavorite: true,
        createdAt: favorite.createdAt,
        updatedAt: favorite.updatedAt,
    };
});
/**
 * Remove favorite by referenceId or favorite _id.
 */
const deleteFavorite = (userId, id) => __awaiter(void 0, void 0, void 0, function* () {
    assertValidObjectId(id);
    const query = {
        userId: new mongoose_1.Types.ObjectId(userId),
        $or: [
            { _id: new mongoose_1.Types.ObjectId(id) },
            { referenceId: new mongoose_1.Types.ObjectId(id) },
        ],
    };
    const result = yield favorite_model_1.Favorite.deleteOne(query);
    if (!result.deletedCount) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Favorite not found");
    }
    return {
        message: "Favorite removed successfully",
        isFavorite: false,
    };
});
exports.FavoriteService = {
    isFavorite,
    getFavoriteProfessionalIds,
    checkFavoriteStatus,
    toggleFavorite,
    getFavorites,
    getSingleFavorite,
    deleteFavorite,
};
