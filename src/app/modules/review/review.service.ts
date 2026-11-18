import mongoose, { Types } from "mongoose";
import { JwtPayload } from "jsonwebtoken";
import { StatusCodes } from "http-status-codes";
import ApiError from "../../../errors/ApiErrors";
import { USER_ROLES } from "../../../enums/user";
import { User } from "../user/user.model";
import { Booking } from "../booking/booking.model";
import { BOOKING_STATUS } from "../booking/booking.constant";
import { JobRequest } from "../jobRequest/jobRequest.model";
import { sendNotifications } from "../../../helpers/notificationsHelper";
import { NOTIFICATION_TYPE } from "../notification/notification.constant";
import QueryBuilder from "../../builder/queryBuilder";
import { reviewSearchableFields } from "./review.constant";
import {
  TCreateReviewPayload,
  TProfessionalReviewSummary,
  TReview,
} from "./review.interface";
import { Review } from "./review.model";

const formatReviewItem = (review: any) => {
  const plain = review.toObject ? review.toObject() : { ...review };
  const homeownerUser = plain.homeowner || plain.tenant;
  const professionalUser = plain.professional || plain.contractor;

  delete plain.tenant;
  delete plain.contractor;
  delete plain.maintenance;

  return {
    ...plain,
    homeowner: homeownerUser,
    professional: professionalUser,
    isReplied: Boolean(
      plain.isReplied || (plain.reply && plain.reply.trim().length > 0),
    ),
    reply: plain.reply || null,
    repliedAt: plain.repliedAt || null,
  };
};

const createReviewIntoDB = async (
  authUser: JwtPayload,
  payload: TCreateReviewPayload,
) => {
  if (authUser.role !== USER_ROLES.HOME_OWNER) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      "Only homeowners can submit a review for a professional",
    );
  }

  const homeownerId = (authUser.userId || authUser.id)?.toString();
  if (!homeownerId) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "User not authenticated");
  }

  // Identify target job/booking
  const targetId =
    payload.bookingId ||
    payload.booking ||
    payload.jobRequestId ||
    payload.jobRequest;

  if (!targetId || !mongoose.Types.ObjectId.isValid(targetId)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "A valid Booking or Job ID is required to submit a review",
    );
  }

  // Find the corresponding booking
  let booking = await Booking.findOne({
    $or: [
      { _id: new Types.ObjectId(targetId) },
      { jobRequest: new Types.ObjectId(targetId) },
    ],
    isDeleted: { $ne: true },
  });

  if (!booking) {
    const job = await JobRequest.findById(targetId);
    if (job) {
      booking = await Booking.findOne({
        jobRequest: job._id,
        isDeleted: { $ne: true },
      });
    }
  }

  if (!booking) {
    throw new ApiError(
      StatusCodes.NOT_FOUND,
      "No completed booking found for this job. You can only review completed jobs.",
    );
  }

  // Check homeowner ownership
  if (booking.homeowner.toString() !== homeownerId) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      "Only the homeowner of this job can submit a review",
    );
  }

  // Only allow review after job completion is confirmed
  if (booking.status !== BOOKING_STATUS.COMPLETED) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "You can only submit a review after confirming job completion.",
    );
  }

  // Check if a review already exists for this booking or job
  const existingReview = await Review.findOne({
    $or: [
      { booking: booking._id },
      { maintenance: booking._id },
      ...(booking.jobRequest
        ? [
            { maintenance: booking.jobRequest },
            { jobRequest: booking.jobRequest },
          ]
        : []),
    ],
  });

  if (existingReview) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      "A review has already been submitted for this job. Only one review per job is allowed.",
    );
  }

  const professionalId = booking.professional.toString();
  if (homeownerId === professionalId) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "You cannot review or rate yourself",
    );
  }

  const reviewData: TReview = {
    professional: new Types.ObjectId(professionalId),
    homeowner: new Types.ObjectId(homeownerId),
    booking: booking._id,
    jobRequest: booking.jobRequest,
    rating: payload.rating,
    feedback: payload.feedback?.trim() || "",
    reply: null,
    repliedAt: null,
    isReplied: false,
    // Backfill legacy fields for database compatibility
    contractor: new Types.ObjectId(professionalId),
    tenant: new Types.ObjectId(homeownerId),
    maintenance: booking._id,
  };

  const createdReview = await Review.create(reviewData);

  // Send notification to professional
  try {
    await sendNotifications({
      receiver: booking.professional,
      sender: new Types.ObjectId(homeownerId),
      title: "New Review Received!",
      text: `You received a ${payload.rating}-star review from your client for your completed work.`,
      type: NOTIFICATION_TYPE.PROFESSIONAL,
      referenceId: createdReview._id,
      referenceModel: "Review" as any,
    });
  } catch {
    // ignore
  }

  const populatedReview = await Review.findById(createdReview._id)
    .populate({
      path: "professional",
      select: "name email profileImage phone companyName",
    })
    .populate({
      path: "homeowner",
      select: "name email profileImage phone city state",
    })
    .populate({
      path: "booking",
      select: "appointmentDate arrivalTimeWindow totalAmount status",
    })
    .lean();

  return formatReviewItem(populatedReview || createdReview);
};

const replyToReviewInDB = async (
  reviewId: string,
  proUserId: string,
  replyText: string,
) => {
  if (!mongoose.Types.ObjectId.isValid(reviewId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid review ID");
  }

  const review = await Review.findById(reviewId);
  if (!review) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Review not found");
  }

  const isProfessional =
    review.professional?.toString() === proUserId ||
    review.contractor?.toString() === proUserId;

  if (!isProfessional) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      "You are not authorized to reply to this review",
    );
  }

  review.reply = replyText.trim();
  review.repliedAt = new Date();
  review.isReplied = true;
  await review.save();

  // Notify homeowner about reply
  try {
    const proUser = await User.findById(proUserId)
      .select("name companyName")
      .lean();
    const proDisplayName =
      proUser?.companyName || proUser?.name || "Professional";

    await sendNotifications({
      receiver: review.homeowner || review.tenant,
      sender: new Types.ObjectId(proUserId),
      title: "Professional Replied to Your Review",
      text: `${proDisplayName} responded to your review: "${replyText.slice(0, 80)}${
        replyText.length > 80 ? "..." : ""
      }"`,
      type: NOTIFICATION_TYPE.HOME_OWNER,
      referenceId: review._id,
      referenceModel: "Review" as any,
    });
  } catch {
    // ignore
  }

  const updatedReview = await Review.findById(review._id)
    .populate({
      path: "professional",
      select: "name email profileImage phone companyName",
    })
    .populate({
      path: "homeowner",
      select: "name email profileImage phone city state",
    })
    .lean();

  return formatReviewItem(updatedReview || review);
};

const deleteReplyFromDB = async (reviewId: string, proUserId: string) => {
  if (!mongoose.Types.ObjectId.isValid(reviewId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid review ID");
  }

  const review = await Review.findById(reviewId);
  if (!review) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Review not found");
  }

  const isProfessional =
    review.professional?.toString() === proUserId ||
    review.contractor?.toString() === proUserId;

  if (!isProfessional) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      "You are not authorized to edit this reply",
    );
  }

  review.reply = null;
  review.repliedAt = null;
  review.isReplied = false;
  await review.save();

  const updatedReview = await Review.findById(review._id)
    .populate({
      path: "professional",
      select: "name email profileImage phone companyName",
    })
    .populate({
      path: "homeowner",
      select: "name email profileImage phone city state",
    })
    .lean();

  return formatReviewItem(updatedReview || review);
};

const getProfessionalReviewsFromDB = async (
  proUserId: string,
  query: Record<string, unknown>,
) => {
  if (!mongoose.Types.ObjectId.isValid(proUserId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid professional ID");
  }

  const proObjectId = new Types.ObjectId(proUserId);
  const ownedByPro = {
    $or: [{ professional: proObjectId }, { contractor: proObjectId }],
  };
  const hasReply = {
    isReplied: true,
    reply: { $nin: [null, ""] },
  };
  const needsReply = { $nor: [hasReply] };

  // Tab count aggregation. Needs-reply must stay inside this pro's reviews.
  const [allCount, needsReplyCount, repliedCount] = await Promise.all([
    Review.countDocuments(ownedByPro),
    Review.countDocuments({ $and: [ownedByPro, needsReply] }),
    Review.countDocuments({ $and: [ownedByPro, hasReply] }),
  ]);

  const tabCounts = {
    all: allCount,
    needsReply: needsReplyCount,
    replied: repliedCount,
  };

  const activeTab = (query.tab as string)?.toLowerCase() || "all";
  const normalizedQuery = { ...query };
  delete normalizedQuery.tab;

  const currentFilter: Record<string, any> =
    activeTab === "needs_reply" ||
    activeTab === "needsreply" ||
    activeTab === "unreplied"
      ? { $and: [ownedByPro, needsReply] }
      : activeTab === "replied"
        ? { $and: [ownedByPro, hasReply] }
        : { ...ownedByPro };

  if (query.rating) {
    currentFilter.rating = Number(query.rating);
    delete normalizedQuery.rating;
  }

  const baseQuery = Review.find(currentFilter)
    .populate({
      path: "homeowner",
      select: "name email profileImage phone city state",
    })
    .populate({
      path: "tenant",
      select: "name email profileImage phone city state",
    })
    .populate({
      path: "professional",
      select: "name email profileImage phone companyName",
    })
    .populate({
      path: "contractor",
      select: "name email profileImage phone companyName",
    });

  const queryBuilder = new QueryBuilder(baseQuery, normalizedQuery)
    .search(reviewSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const [reviews, meta, summary] = await Promise.all([
    queryBuilder.modelQuery.lean(),
    queryBuilder.countTotal(),
    Review.calculateAverageRating(proUserId),
  ]);

  return {
    meta,
    summary,
    tabCounts,
    activeTab,
    data: (reviews || []).map(formatReviewItem),
  };
};

const getProfessionalReviewSummaryFromDB = async (
  professionalId: string,
): Promise<TProfessionalReviewSummary> => {
  if (!mongoose.Types.ObjectId.isValid(professionalId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid professional ID");
  }

  return await Review.calculateAverageRating(professionalId);
};

const getReviewByBookingIdFromDB = async (bookingId: string) => {
  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid booking ID");
  }

  const review = await Review.findOne({
    $or: [
      { booking: new Types.ObjectId(bookingId) },
      { maintenance: new Types.ObjectId(bookingId) },
      { jobRequest: new Types.ObjectId(bookingId) },
    ],
  })
    .populate({
      path: "professional",
      select: "name email profileImage phone companyName",
    })
    .populate({
      path: "contractor",
      select: "name email profileImage phone companyName",
    })
    .populate({
      path: "homeowner",
      select: "name email profileImage phone city state",
    })
    .populate({
      path: "tenant",
      select: "name email profileImage phone city state",
    })
    .lean();

  return review ? formatReviewItem(review) : null;
};

const getMyReviewsFromDB = async (
  authUser: JwtPayload,
  query: Record<string, unknown>,
) => {
  const currentUserId = (authUser.userId || authUser.id)?.toString();
  if (!currentUserId) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "User not authenticated");
  }

  // If professional, return received reviews dashboard
  if (authUser.role === USER_ROLES.PROFESSIONAL) {
    return await getProfessionalReviewsFromDB(currentUserId, query);
  }

  // If homeowner, return submitted reviews
  const baseQuery = Review.find({
    $or: [
      { homeowner: new Types.ObjectId(currentUserId) },
      { tenant: new Types.ObjectId(currentUserId) },
    ],
  })
    .populate({
      path: "professional",
      select: "name email profileImage phone companyName",
    })
    .populate({
      path: "contractor",
      select: "name email profileImage phone companyName",
    });

  const queryBuilder = new QueryBuilder(baseQuery, query)
    .search(reviewSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const [reviews, meta] = await Promise.all([
    queryBuilder.modelQuery.lean(),
    queryBuilder.countTotal(),
  ]);

  return {
    meta,
    data: (reviews || []).map(formatReviewItem),
  };
};

const getSingleReviewFromDB = async (id: string) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid review ID");
  }

  const review = await Review.findById(id)
    .populate({
      path: "professional",
      select: "name email profileImage phone companyName",
    })
    .populate({
      path: "contractor",
      select: "name email profileImage phone companyName",
    })
    .populate({
      path: "homeowner",
      select: "name email profileImage phone city state",
    })
    .populate({
      path: "tenant",
      select: "name email profileImage phone city state",
    })
    .lean();

  if (!review) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Review not found");
  }

  return formatReviewItem(review);
};

export const ReviewService = {
  createReviewIntoDB,
  replyToReviewInDB,
  deleteReplyFromDB,
  getProfessionalReviewsFromDB,
  getProfessionalReviewSummaryFromDB,
  getReviewByBookingIdFromDB,
  getMyReviewsFromDB,
  getSingleReviewFromDB,
};
