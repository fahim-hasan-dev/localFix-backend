import { Types } from "mongoose";
import { ISoftDeleteModel } from "../../../types/softDelete";
import {
  BOOKING_PAYMENT_METHOD,
  BOOKING_PAYMENT_STATUS,
  BOOKING_STATUS,
} from "./booking.constant";

export type IRescheduleRecord = {
  appointmentDate: Date;
  arrivalTimeWindow: string;
  paymentMethod?: BOOKING_PAYMENT_METHOD | string;
  rescheduledAt: Date;
};

export type IBooking = {
  jobId?: string;
  orderId?: string;
  jobRequest: Types.ObjectId;
  quotation: Types.ObjectId;
  homeowner: Types.ObjectId;
  professional: Types.ObjectId;
  totalAmount: number;
  appointmentDate: Date;
  arrivalTimeWindow: string;
  paymentMethod: BOOKING_PAYMENT_METHOD | string;
  status: BOOKING_STATUS;

  // Work lifecycle
  onTheWayAt?: Date | null;
  workStartedAt?: Date | null;
  contractorCompletedAt?: Date | null;
  contractorCompletionNote?: string;

  // Homeowner confirmation & payment
  homeownerCompletedAt?: Date | null;
  settledPaymentMethod?: BOOKING_PAYMENT_METHOD | string;
  paymentStatus?: BOOKING_PAYMENT_STATUS;
  paidAt?: Date | null;
  stripeSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  stripePaymentUrl?: string | null;
  isPaidDirectly?: boolean;
  isSatisfactionConfirmed?: boolean;

  // Cancellation
  cancelledAt?: Date | null;
  cancelledBy?: Types.ObjectId | null;
  cancellationReason?: string;

  // Reschedule
  rescheduledAt?: Date | null;
  rescheduleHistory?: IRescheduleRecord[];

  isDeleted?: boolean;
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export type IBookingModel = ISoftDeleteModel<IBooking>;
