import { model, Schema } from "mongoose";
import { softDeletePlugin } from "../../../DB/plugins/softDeletePlugin";
import {
  QUOTATION_PARTS_MATERIALS,
  QUOTATION_PRICE_TYPE,
  QUOTATION_STATUS,
} from "./quotation.constant";
import { IQuotation, IQuotationModel } from "./quotation.interface";

const quotationSchema = new Schema<IQuotation, IQuotationModel>(
  {
    jobRequest: {
      type: Schema.Types.ObjectId,
      ref: "JobRequest",
      required: true,
      index: true,
    },
    professional: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    homeowner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    priceType: {
      type: String,
      enum: Object.values(QUOTATION_PRICE_TYPE),
      required: true,
      trim: true,
    },
    totalRate: {
      type: Number,
      required: true,
      min: 0,
    },
    scopeOfWork: {
      type: String,
      required: true,
      trim: true,
    },
    exclusions: {
      type: String,
      trim: true,
      default: "",
    },
    partsAndMaterialsIncluded: {
      type: String,
      enum: Object.values(QUOTATION_PARTS_MATERIALS),
      required: true,
      trim: true,
    },
    estimatedDuration: {
      type: String,
      required: true,
      trim: true,
    },
    earliestAvailableDate: {
      type: Date,
      required: true,
    },
    arrivalTimeWindow: {
      type: String,
      required: true,
      trim: true,
    },
    warranty: {
      type: String,
      trim: true,
      default: "",
    },
    offerValidUntil: {
      type: Date,
      default: null,
    },
    additionalNotes: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: Object.values(QUOTATION_STATUS),
      default: QUOTATION_STATUS.PENDING,
      index: true,
    },
    isHired: {
      type: Boolean,
      default: false,
    },
    appointmentDate: {
      type: Date,
      default: null,
    },
    paymentMethod: {
      type: String,
      trim: true,
      default: "",
    },
    confirmedArrivalWindow: {
      type: String,
      trim: true,
      default: "",
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
    declinedAt: {
      type: Date,
      default: null,
    },
    declineReason: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

quotationSchema.plugin(softDeletePlugin);

quotationSchema.index({ jobRequest: 1, professional: 1 });
quotationSchema.index({ homeowner: 1, status: 1 });
quotationSchema.index({ professional: 1, status: 1 });
quotationSchema.index({ status: 1, createdAt: -1 });

export const Quotation = model<IQuotation, IQuotationModel>(
  "Quotation",
  quotationSchema,
);
