import { model, Schema } from "mongoose";
import { softDeletePlugin } from "../../../DB/plugins/softDeletePlugin";
import {
  BOOKING_PAYMENT_METHOD,
  BOOKING_PAYMENT_STATUS,
  BOOKING_STATUS,
  normalizePaymentMethod,
} from "./booking.constant";
import { IBooking, IBookingModel } from "./booking.interface";

const rescheduleRecordSchema = new Schema(
  {
    appointmentDate: { type: Date, required: true },
    arrivalTimeWindow: { type: String, required: true, trim: true },
    paymentMethod: {
      type: String,
      trim: true,
      default: BOOKING_PAYMENT_METHOD.CASH,
      set: (val: string) => (val ? normalizePaymentMethod(val) : val),
    },
    rescheduledAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const bookingSchema = new Schema<IBooking, IBookingModel>(
  {
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
      type: Schema.Types.ObjectId,
      ref: "JobRequest",
      required: true,
      index: true,
    },
    quotation: {
      type: Schema.Types.ObjectId,
      ref: "Quotation",
      required: true,
      index: true,
    },
    homeowner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    professional: {
      type: Schema.Types.ObjectId,
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
      default: BOOKING_PAYMENT_METHOD.CASH,
      set: (val: string) => (val ? normalizePaymentMethod(val) : val),
    },
    status: {
      type: String,
      enum: Object.values(BOOKING_STATUS),
      default: BOOKING_STATUS.SCHEDULED,
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
      set: (val: string) => (val ? normalizePaymentMethod(val) : val),
    },
    paymentStatus: {
      type: String,
      enum: Object.values(BOOKING_PAYMENT_STATUS),
      default: BOOKING_PAYMENT_STATUS.PENDING,
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
      type: Schema.Types.ObjectId,
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
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

bookingSchema.pre("save", async function (next) {
  if (!this.jobId) {
    try {
      const job = await (this.constructor as any).db
        .collection("jobrequests")
        .findOne({ _id: this.jobRequest });
      if (job && job.jobId) {
        this.jobId = job.jobId;
      } else {
        const count = await (this.constructor as any).countDocuments();
        this.jobId = `#JOB-${8421 + count}`;
      }
    } catch {
      this.jobId = `#JOB-${Math.floor(8000 + Math.random() * 999)}`;
    }
  }
  if (!this.orderId) {
    const cleanJobId = (this.jobId || "").replace(/^#/, "");
    this.orderId = `#OR-${cleanJobId || Math.floor(1000 + Math.random() * 9000)}`;
  }
  next();
});

bookingSchema.plugin(softDeletePlugin);

bookingSchema.index({ homeowner: 1, status: 1, appointmentDate: -1 });
bookingSchema.index({ professional: 1, status: 1, appointmentDate: -1 });
bookingSchema.index({ jobRequest: 1, homeowner: 1 });

export const Booking = model<IBooking, IBookingModel>("Booking", bookingSchema);
