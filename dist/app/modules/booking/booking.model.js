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
exports.Booking = void 0;
const mongoose_1 = require("mongoose");
const softDeletePlugin_1 = require("../../../DB/plugins/softDeletePlugin");
const booking_constant_1 = require("./booking.constant");
const rescheduleRecordSchema = new mongoose_1.Schema({
    appointmentDate: { type: Date, required: true },
    arrivalTimeWindow: { type: String, required: true, trim: true },
    paymentMethod: {
        type: String,
        trim: true,
        default: booking_constant_1.BOOKING_PAYMENT_METHOD.CASH,
        set: (val) => (val ? (0, booking_constant_1.normalizePaymentMethod)(val) : val),
    },
    rescheduledAt: { type: Date, default: Date.now },
}, { _id: false });
const bookingSchema = new mongoose_1.Schema({
    jobId: {
        type: String,
        trim: true,
        index: true,
    },
    orderId: {
        type: String,
        trim: true,
        index: true,
    },
    jobRequest: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "JobRequest",
        required: true,
        index: true,
    },
    quotation: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Quotation",
        required: true,
        index: true,
    },
    homeowner: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    professional: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    totalAmount: {
        type: Number,
        required: true,
        min: 0,
    },
    appointmentDate: {
        type: Date,
        required: true,
        index: true,
    },
    arrivalTimeWindow: {
        type: String,
        required: true,
        trim: true,
    },
    paymentMethod: {
        type: String,
        required: true,
        trim: true,
        default: booking_constant_1.BOOKING_PAYMENT_METHOD.CASH,
        set: (val) => (val ? (0, booking_constant_1.normalizePaymentMethod)(val) : val),
    },
    status: {
        type: String,
        enum: Object.values(booking_constant_1.BOOKING_STATUS),
        default: booking_constant_1.BOOKING_STATUS.SCHEDULED,
        index: true,
    },
    // Work lifecycle
    onTheWayAt: {
        type: Date,
        default: null,
    },
    workStartedAt: {
        type: Date,
        default: null,
    },
    contractorCompletedAt: {
        type: Date,
        default: null,
    },
    contractorCompletionNote: {
        type: String,
        trim: true,
        default: "",
    },
    // Homeowner completion & payment
    homeownerCompletedAt: {
        type: Date,
        default: null,
    },
    settledPaymentMethod: {
        type: String,
        trim: true,
        default: "",
        set: (val) => (val ? (0, booking_constant_1.normalizePaymentMethod)(val) : val),
    },
    paymentStatus: {
        type: String,
        enum: Object.values(booking_constant_1.BOOKING_PAYMENT_STATUS),
        default: booking_constant_1.BOOKING_PAYMENT_STATUS.PENDING,
        index: true,
    },
    paidAt: {
        type: Date,
        default: null,
    },
    stripeSessionId: {
        type: String,
        trim: true,
        default: null,
        index: true,
    },
    stripePaymentIntentId: {
        type: String,
        trim: true,
        default: null,
        index: true,
    },
    stripePaymentUrl: {
        type: String,
        trim: true,
        default: null,
    },
    isPaidDirectly: {
        type: Boolean,
        default: false,
    },
    isSatisfactionConfirmed: {
        type: Boolean,
        default: false,
    },
    // Cancellation
    cancelledAt: {
        type: Date,
        default: null,
    },
    cancelledBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        default: null,
    },
    cancellationReason: {
        type: String,
        trim: true,
        default: "",
    },
    // Reschedule
    rescheduledAt: {
        type: Date,
        default: null,
    },
    rescheduleHistory: {
        type: [rescheduleRecordSchema],
        default: [],
    },
}, {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
bookingSchema.pre("save", function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!this.jobId) {
            try {
                const job = yield this.constructor.db
                    .collection("jobrequests")
                    .findOne({ _id: this.jobRequest });
                if (job && job.jobId) {
                    this.jobId = job.jobId;
                }
                else {
                    const count = yield this.constructor.countDocuments();
                    this.jobId = `#JOB-${8421 + count}`;
                }
            }
            catch (_a) {
                this.jobId = `#JOB-${Math.floor(8000 + Math.random() * 999)}`;
            }
        }
        if (!this.orderId) {
            const cleanJobId = (this.jobId || "").replace(/^#/, "");
            this.orderId = `#OR-${cleanJobId || Math.floor(1000 + Math.random() * 9000)}`;
        }
        next();
    });
});
bookingSchema.plugin(softDeletePlugin_1.softDeletePlugin);
bookingSchema.index({ homeowner: 1, status: 1, appointmentDate: -1 });
bookingSchema.index({ professional: 1, status: 1, appointmentDate: -1 });
bookingSchema.index({ jobRequest: 1, homeowner: 1 });
exports.Booking = (0, mongoose_1.model)("Booking", bookingSchema);
