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
exports.Review = void 0;
const mongoose_1 = require("mongoose");
const http_status_codes_1 = require("http-status-codes");
const ApiErrors_1 = __importDefault(require("../../../errors/ApiErrors"));
const reviewSchema = new mongoose_1.Schema({
    professional: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: [true, "Professional ID is required"],
    },
    homeowner: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: [true, "Homeowner ID is required"],
    },
    booking: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Booking",
        required: [true, "Booking ID is required"],
    },
    jobRequest: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "JobRequest",
    },
    // Legacy fields for existing documents in database
    contractor: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
    },
    tenant: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
    },
    maintenance: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "JobRequest",
    },
    rating: {
        type: Number,
        required: [true, "Rating is required"],
        min: [1, "Rating must be at least 1"],
        max: [5, "Rating cannot exceed 5"],
        validate: {
            validator: function (val) {
                return Number.isInteger(val) && val >= 1 && val <= 5;
            },
            message: "Rating must be an integer between 1 and 5. Float/decimal ratings are not allowed.",
        },
    },
    feedback: {
        type: String,
        trim: true,
        default: "",
    },
    reply: {
        type: String,
        trim: true,
        default: null,
    },
    repliedAt: {
        type: Date,
        default: null,
    },
    isReplied: {
        type: Boolean,
        default: false,
    },
}, {
    timestamps: true,
    versionKey: false,
});
reviewSchema.index({ booking: 1 });
reviewSchema.index({ professional: 1, createdAt: -1 });
reviewSchema.index({ homeowner: 1 });
reviewSchema.index({ contractor: 1 });
reviewSchema.index({ tenant: 1 });
reviewSchema.index({ isReplied: 1 });
reviewSchema.pre("validate", function (next) {
    var _a, _b;
    const homeownerId = (_a = (this.homeowner || this.tenant)) === null || _a === void 0 ? void 0 : _a.toString();
    const professionalId = (_b = (this.professional || this.contractor)) === null || _b === void 0 ? void 0 : _b.toString();
    // Automatically backfill professional and homeowner if missing
    if (!this.professional && this.contractor) {
        this.professional = this.contractor;
    }
    if (!this.homeowner && this.tenant) {
        this.homeowner = this.tenant;
    }
    if (homeownerId && professionalId && homeownerId === professionalId) {
        return next(new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "You cannot review or rate yourself"));
    }
    next();
});
reviewSchema.statics.calculateAverageRating = function (professionalId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const targetProfessionalId = typeof professionalId === "string"
            ? new mongoose_1.Types.ObjectId(professionalId)
            : professionalId;
        const stats = yield this.aggregate([
            {
                $match: {
                    $or: [
                        { professional: targetProfessionalId },
                        { contractor: targetProfessionalId },
                    ],
                },
            },
            {
                $group: {
                    _id: null,
                    totalReviews: { $sum: 1 },
                    averageRating: { $avg: "$rating" },
                    fiveStar: { $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] } },
                    fourStar: { $sum: { $cond: [{ $eq: ["$rating", 4] }, 1, 0] } },
                    threeStar: { $sum: { $cond: [{ $eq: ["$rating", 3] }, 1, 0] } },
                    twoStar: { $sum: { $cond: [{ $eq: ["$rating", 2] }, 1, 0] } },
                    oneStar: { $sum: { $cond: [{ $eq: ["$rating", 1] }, 1, 0] } },
                },
            },
        ]);
        if (stats.length > 0) {
            const rawAverage = (_a = stats[0].averageRating) !== null && _a !== void 0 ? _a : 0;
            const total = stats[0].totalReviews || 0;
            const fiveStar = stats[0].fiveStar || 0;
            const fourStar = stats[0].fourStar || 0;
            const threeStar = stats[0].threeStar || 0;
            const twoStar = stats[0].twoStar || 0;
            const oneStar = stats[0].oneStar || 0;
            const positiveReviews = fiveStar + fourStar;
            const recommendationRate = total > 0 ? Math.round((positiveReviews / total) * 100) : 100;
            return {
                professional: targetProfessionalId,
                averageRating: parseFloat(rawAverage.toFixed(1)),
                totalReviews: total,
                recommendationRate,
                recommendationPercentage: recommendationRate,
                ratingDistribution: {
                    5: fiveStar,
                    4: fourStar,
                    3: threeStar,
                    2: twoStar,
                    1: oneStar,
                },
                ratingBreakdown: {
                    5: {
                        count: fiveStar,
                        percentage: total > 0 ? Math.round((fiveStar / total) * 100) : 0,
                    },
                    4: {
                        count: fourStar,
                        percentage: total > 0 ? Math.round((fourStar / total) * 100) : 0,
                    },
                    3: {
                        count: threeStar,
                        percentage: total > 0 ? Math.round((threeStar / total) * 100) : 0,
                    },
                    2: {
                        count: twoStar,
                        percentage: total > 0 ? Math.round((twoStar / total) * 100) : 0,
                    },
                    1: {
                        count: oneStar,
                        percentage: total > 0 ? Math.round((oneStar / total) * 100) : 0,
                    },
                },
            };
        }
        return {
            professional: targetProfessionalId,
            averageRating: 0.0,
            totalReviews: 0,
            recommendationRate: 0,
            recommendationPercentage: 0,
            ratingDistribution: {
                5: 0,
                4: 0,
                3: 0,
                2: 0,
                1: 0,
            },
            ratingBreakdown: {
                5: { count: 0, percentage: 0 },
                4: { count: 0, percentage: 0 },
                3: { count: 0, percentage: 0 },
                2: { count: 0, percentage: 0 },
                1: { count: 0, percentage: 0 },
            },
        };
    });
};
exports.Review = (0, mongoose_1.model)("Review", reviewSchema);
