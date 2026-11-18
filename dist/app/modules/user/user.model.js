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
exports.User = void 0;
const mongoose_1 = require("mongoose");
const user_1 = require("../../../enums/user");
const bcrypt_1 = __importDefault(require("bcrypt"));
const config_1 = __importDefault(require("../../../config"));
const softDeletePlugin_1 = require("../../../DB/plugins/softDeletePlugin");
const businessDayHoursSchema = new mongoose_1.Schema({
    isOpen: { type: Boolean, default: true },
    openTime: { type: String, default: "8:00 AM", trim: true },
    closeTime: { type: String, default: "6:00 PM", trim: true },
}, { _id: false });
const projectPhotoSchema = new mongoose_1.Schema({
    image: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    category: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Category",
        required: true,
    },
    createdAt: { type: Date, default: Date.now },
}, { _id: true });
const userSchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    role: {
        type: String,
        enum: Object.values(user_1.USER_ROLES),
        default: user_1.USER_ROLES.HOME_OWNER,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    profileImage: {
        type: String,
        required: false,
        default: "",
    },
    dateOfBirth: {
        type: Date,
        required: false,
    },
    gender: {
        type: String,
        enum: Object.values(user_1.GENDER),
        default: user_1.GENDER.MALE,
    },
    password: {
        type: String,
        required: false,
        select: 0,
        minlength: 6,
    },
    status: {
        type: String,
        enum: Object.values(user_1.STATUS),
        default: user_1.STATUS.ACTIVE,
    },
    approvalStatus: {
        type: String,
        enum: Object.values(user_1.APPROVAL_STATUS),
        default: user_1.APPROVAL_STATUS.APPROVED,
    },
    rejectionReason: {
        type: String,
        default: null,
        trim: true,
    },
    agreedToTerms: {
        type: Boolean,
        default: false,
    },
    termsAcceptedAt: {
        type: Date,
        default: null,
    },
    about: {
        type: String,
        required: false,
        trim: true,
    },
    serviceRadiusInMiles: {
        type: Number,
        required: false,
    },
    yearsOfExperience: {
        type: String,
        required: false,
        trim: true,
    },
    category: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Category",
        required: false,
        default: null,
    },
    phone: {
        type: String,
        required: false,
        trim: true,
    },
    countryCode: {
        type: String,
        required: false,
    },
    firebaseUid: {
        type: String,
        unique: true,
        sparse: true,
    },
    deviceToken: {
        type: String,
        required: false,
    },
    verified: {
        type: Boolean,
        default: false,
    },
    state: {
        type: String,
        required: false,
        trim: true,
    },
    city: {
        type: String,
        required: false,
        trim: true,
    },
    zipCode: {
        type: String,
        required: false,
        trim: true,
    },
    streetAddress: {
        type: String,
        required: false,
        trim: true,
    },
    companyName: {
        type: String,
        required: false,
        trim: true,
    },
    tradeLicense: {
        licenseNumber: {
            type: String,
            trim: true,
        },
        state: {
            type: String,
            trim: true,
        },
        certificateUrl: {
            type: String,
            default: "",
        },
        isVerified: {
            type: Boolean,
            default: false,
        },
    },
    liabilityInsurance: {
        carrier: {
            type: String,
            trim: true,
        },
        coverage: {
            type: String,
            trim: true,
        },
        expires: {
            type: String,
            trim: true,
        },
        certificateUrl: {
            type: String,
            default: "",
        },
        isVerified: {
            type: Boolean,
            default: false,
        },
    },
    businessHours: {
        mode: {
            type: String,
            enum: ["all_days", "customize"],
            default: "all_days",
        },
        allDays: {
            type: businessDayHoursSchema,
            default: () => ({
                isOpen: true,
                openTime: "8:00 AM",
                closeTime: "6:00 PM",
            }),
        },
        days: {
            monday: { type: businessDayHoursSchema, default: () => ({}) },
            tuesday: { type: businessDayHoursSchema, default: () => ({}) },
            wednesday: { type: businessDayHoursSchema, default: () => ({}) },
            thursday: { type: businessDayHoursSchema, default: () => ({}) },
            friday: { type: businessDayHoursSchema, default: () => ({}) },
            saturday: { type: businessDayHoursSchema, default: () => ({}) },
            sunday: { type: businessDayHoursSchema, default: () => ({}) },
        },
        emergencyDispatchAvailable: {
            type: Boolean,
            default: false,
        },
    },
    acceptedPayments: {
        type: [String],
        default: [],
    },
    projectPhotos: {
        type: [projectPhotoSchema],
        default: [],
    },
    startingRate: {
        type: Number,
        default: 85,
    },
    hourlyRate: {
        type: Number,
        default: 85,
    },
    completedJobs: {
        type: Number,
        default: 0,
    },
    localJobs: {
        type: Number,
        default: 0,
    },
    responseTime: {
        type: String,
        default: "Replies in ~20 mins",
        trim: true,
    },
    availability: {
        type: String,
        default: "Available this week",
        trim: true,
    },
    backgroundCheck: {
        consentAccepted: {
            type: Boolean,
            default: false,
        },
        consentAcceptedAt: {
            type: Date,
            default: null,
        },
        status: {
            type: String,
            enum: Object.values(user_1.CHECKR_VERIFICATION_STATUS),
            default: user_1.CHECKR_VERIFICATION_STATUS.NOT_STARTED,
        },
        passed: {
            type: Boolean,
            default: false,
        },
        checkrCandidateId: {
            type: String,
            index: true,
            sparse: true,
        },
        checkrInvitationId: {
            type: String,
            index: true,
            sparse: true,
        },
        checkrInvitationUrl: {
            type: String,
            default: "",
        },
        invitationStatus: {
            type: String,
            enum: Object.values(user_1.CHECKR_INVITATION_STATUS),
            default: user_1.CHECKR_INVITATION_STATUS.NOT_SENT,
        },
        checkrReportId: {
            type: String,
            index: true,
            sparse: true,
        },
        checkrPackage: {
            type: String,
        },
        result: {
            type: String,
            default: null,
        },
        verifiedAt: {
            type: Date,
            default: null,
        },
        lastCheckedAt: {
            type: Date,
            default: null,
        },
        notes: {
            type: String,
        },
    },
    location: {
        type: {
            type: String,
            enum: ["Point"],
            default: "Point",
        },
        coordinates: {
            type: [Number],
            default: [0, 0],
        },
        address: {
            type: String,
            default: "",
        },
    },
    authentication: {
        type: {
            isResetPassword: {
                type: Boolean,
                default: false,
            },
            oneTimeCode: {
                type: Number,
                default: null,
            },
            expireAt: {
                type: Date,
                default: null,
            },
            authType: {
                type: String,
                default: null,
            },
        },
        select: 0,
    },
    timezone: {
        type: String,
        default: "Asia/Dhaka",
    },
}, {
    timestamps: true,
    versionKey: false,
    toJSON: {
        virtuals: true,
        transform: (_doc, ret) => {
            delete ret.id;
            delete ret.password;
            delete ret.authentication;
            return ret;
        },
    },
    toObject: {
        virtuals: true,
        transform: (_doc, ret) => {
            delete ret.id;
            delete ret.password;
            delete ret.authentication;
            return ret;
        },
    },
});
/* ================= PLUGIN ================= */
userSchema.plugin(softDeletePlugin_1.softDeletePlugin);
// exist user check
userSchema.statics.isExistUserById = (id) => __awaiter(void 0, void 0, void 0, function* () {
    return yield exports.User.findById(id);
});
userSchema.statics.isExistUserByEmail = (email) => __awaiter(void 0, void 0, void 0, function* () {
    return yield exports.User.findOne({ email });
});
// is match password
userSchema.statics.isMatchPassword = (password, hashPassword) => __awaiter(void 0, void 0, void 0, function* () {
    return yield bcrypt_1.default.compare(password, hashPassword);
});
// hash password pre-save
userSchema.pre("save", function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (this.isModified("password") && this.password) {
            this.password = yield bcrypt_1.default.hash(this.password, Number(config_1.default.bcrypt_salt_rounds));
        }
        next();
    });
});
userSchema.index({ role: 1 });
userSchema.index({ role: 1, status: 1 });
userSchema.index({ category: 1, role: 1 });
userSchema.index({ location: "2dsphere" });
exports.User = (0, mongoose_1.model)("User", userSchema);
