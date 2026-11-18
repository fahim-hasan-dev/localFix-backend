import { Model, Types } from "mongoose";

export type TRating = 1 | 2 | 3 | 4 | 5;

export type TRatingDistribution = {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
};

export type TRatingBreakdownItem = {
  count: number;
  percentage: number;
};

export type TRatingBreakdown = {
  1: TRatingBreakdownItem;
  2: TRatingBreakdownItem;
  3: TRatingBreakdownItem;
  4: TRatingBreakdownItem;
  5: TRatingBreakdownItem;
};

export type TProfessionalReviewSummary = {
  professional: Types.ObjectId | string;
  averageRating: number; // Float representation e.g. 4.8
  totalReviews: number;
  recommendationRate?: number; // e.g. 100
  recommendationPercentage?: number; // e.g. 100
  ratingDistribution: TRatingDistribution;
  ratingBreakdown?: TRatingBreakdown;
};

// Alias for backwards compatibility if needed
export type TContractorReviewSummary = TProfessionalReviewSummary;

export type TReview = {
  professional: Types.ObjectId;
  homeowner: Types.ObjectId;
  booking: Types.ObjectId;
  jobRequest?: Types.ObjectId;
  rating: TRating;
  feedback?: string;
  reply?: string | null;
  repliedAt?: Date | string | null;
  isReplied?: boolean;
  // Legacy fields for reading existing DB documents
  contractor?: Types.ObjectId;
  tenant?: Types.ObjectId;
  maintenance?: Types.ObjectId;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

export type TCreateReviewPayload = {
  professional?: string;
  professionalId?: string;
  bookingId?: string;
  booking?: string;
  jobRequestId?: string;
  jobRequest?: string;
  rating: TRating;
  feedback?: string;
};

export type TReviewReplyPayload = {
  reply?: string;
  comment?: string;
  response?: string;
};

export type TProReviewTabCounts = {
  all: number;
  needsReply: number;
  replied: number;
};

export interface ReviewModel extends Model<TReview> {
  calculateAverageRating(
    professionalId: Types.ObjectId | string,
  ): Promise<TProfessionalReviewSummary>;
}
