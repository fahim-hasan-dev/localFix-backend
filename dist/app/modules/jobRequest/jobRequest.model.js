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
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobRequest = void 0;
const mongoose_1 = require("mongoose");
const softDeletePlugin_1 = require("../../../DB/plugins/softDeletePlugin");
const jobRequest_1 = require("../../../enums/jobRequest");
const serviceLocationSchema = new mongoose_1.Schema({
    zipCode: {
        type: String,
        required: true,
        trim: true,
    },
    address: {
        type: String,
        trim: true,
        default: "",
    },
    city: {
        type: String,
        trim: true,
        default: "",
    },
    state: {
        type: String,
        trim: true,
        default: "",
    },
    location: {
        type: {
            type: String,
            enum: ["Point"],
            default: "Point",
        },
        coordinates: {
            type: [Number],
            default: undefined,
        },
        address: {
            type: String,
            default: "",
        },
    },
}, { _id: false });
const jobRequestSchema = new mongoose_1.Schema({
    jobId: {
        type: String,
        trim: true,
        index: true,
    },
    homeowner: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    category: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Category",
        required: true,
        index: true,
    },
    headline: {
        type: String,
        required: true,
        trim: true,
    },
    title: {
        type: String,
        trim: true,
    },
    description: {
        type: String,
        required: true,
        trim: true,
    },
    projectPhotos: {
        type: [String],
        default: [],
    },
    timeframe: {
        type: String,
        required: true,
        trim: true,
    },
    serviceLocation: {
        type: serviceLocationSchema,
        required: true,
    },
    preferredArrivalWindow: {
        type: String,
        trim: true,
        default: "Anytime (Flexible arrival)",
    },
    propertyType: {
        type: String,
        required: true,
        trim: true,
    },
    partsAndMaterials: {
        type: String,
        required: true,
        trim: true,
    },
    estimatedBudget: {
        type: Number,
        default: 0,
    },
    professional: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        default: null,
        index: true,
    },
    status: {
        type: String,
        enum: Object.values(jobRequest_1.JOB_REQUEST_STATUS),
        default: jobRequest_1.JOB_REQUEST_STATUS.AWAITING_QUOTES,
        index: true,
    },
    quotesCount: {
        type: Number,
        default: 0,
    },
    rejectedBy: {
        type: [mongoose_1.Schema.Types.ObjectId],
        ref: "User",
        default: [],
    },
    isUrgent: {
        type: Boolean,
        default: false,
        index: true,
    },
}, {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
jobRequestSchema.pre("save", function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (this.headline && !this.title) {
            this.title = this.headline;
        }
        else if (this.title && !this.headline) {
            this.headline = this.title;
        }
        if (this.timeframe) {
            this.isUrgent = /urgent|asap|emergency/i.test(this.timeframe);
        }
        if (!this.jobId) {
            try {
                const count = yield this.constructor.countDocuments();
                this.jobId = `#JOB-${101 + count}`;
            }
            catch (_a) {
                this.jobId = `#JOB-${Math.floor(100 + Math.random() * 900)}`;
            }
        }
        next();
    });
});
jobRequestSchema.plugin(softDeletePlugin_1.softDeletePlugin);
jobRequestSchema.index({ homeowner: 1, createdAt: -1 });
jobRequestSchema.index({ category: 1, status: 1 });
jobRequestSchema.index({ professional: 1, status: 1 });
jobRequestSchema.index({ "serviceLocation.zipCode": 1 });
jobRequestSchema.index({ rejectedBy: 1 });
jobRequestSchema.index({ isUrgent: -1, createdAt: -1 });
jobRequestSchema.index({ estimatedBudget: -1, createdAt: -1 });
exports.JobRequest = (0, mongoose_1.model)("JobRequest", jobRequestSchema);
