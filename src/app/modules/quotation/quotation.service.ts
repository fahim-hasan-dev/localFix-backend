import { Types } from "mongoose";
import { StatusCodes } from "http-status-codes";
import ApiError from "../../../errors/ApiErrors";
import QueryBuilder from "../../builder/queryBuilder";
import { sendNotifications } from "../../../helpers/notificationsHelper";
import { NOTIFICATION_TYPE } from "../notification/notification.constant";
import { USER_ROLES } from "../../../enums/user";
import { JOB_REQUEST_STATUS } from "../../../enums/jobRequest";
import { JobRequest } from "../jobRequest/jobRequest.model";
import { User } from "../user/user.model";
import { Review } from "../review/review.model";
import { Quotation } from "./quotation.model";
import { IQuotation } from "./quotation.interface";
import { Booking } from "../booking/booking.model";
import { realtimeSocket } from "../realtime/realtime.socket";
import {
  BOOKING_PAYMENT_METHOD,
  BOOKING_STATUS,
} from "../booking/booking.constant";
import {
  QUOTATION_STATUS,
  quotationFilterableFields,
  quotationSearchableFields,
} from "./quotation.constant";
import { verifyQuotationSubscriptionGuard } from "../subscription/subscription.helper";

const assertValidObjectId = (id: string, fieldName = "ID") => {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, `Invalid ${fieldName}`);
  }
};

const isAdminRole = (role?: string) =>
  role === USER_ROLES.ADMIN || role === USER_ROLES.SUPER_ADMIN;

const populateProfessionalRating = async (quote: any) => {
  let averageRating = 0;
  let totalReviews = 0;
  const proId = quote.professional?._id || quote.professional;
  if (proId) {
    try {
      const summary = await Review.calculateAverageRating(proId);
      averageRating = summary.averageRating || 0;
      totalReviews = summary.totalReviews || 0;
    } catch {
      // ignore calculation errors
    }
  }

  const isExpired = Boolean(
    quote.offerValidUntil && new Date() > new Date(quote.offerValidUntil),
  );

  let currentStatus = quote.status;
  if (quote.status === QUOTATION_STATUS.PENDING && isExpired) {
    currentStatus = QUOTATION_STATUS.EXPIRED;
    // update status in DB if not already updated
    Quotation.updateOne(
      { _id: quote._id, status: QUOTATION_STATUS.PENDING },
      { status: QUOTATION_STATUS.EXPIRED },
    ).exec();
  }

  return {
    ...quote,
    status: currentStatus,
    isExpired,
    professional:
      typeof quote.professional === "object" && quote.professional !== null
        ? {
            ...quote.professional,
            averageRating,
            totalReviews,
          }
        : quote.professional,
  };
};

const createQuotationToDB = async (
  proId: string,
  payload: Partial<IQuotation> & { jobRequest: string },
) => {
  assertValidObjectId(payload.jobRequest, "Job Request ID");

  const jobRequest = await JobRequest.findById(payload.jobRequest);
  if (!jobRequest || (jobRequest as any).isDeleted) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Job request not found");
  }

  // Prevent sending quotes to closed, cancelled, or in-progress jobs
  if (
    jobRequest.status === JOB_REQUEST_STATUS.COMPLETED ||
    jobRequest.status === JOB_REQUEST_STATUS.CANCELLED ||
    jobRequest.status === JOB_REQUEST_STATUS.IN_PROGRESS
  ) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "This job request is no longer accepting quotations",
    );
  }

  // If this was a direct request targeted to a specific pro, ensure caller is that pro
  if (jobRequest.professional && jobRequest.professional.toString() !== proId) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      "This is a direct job request assigned to another professional",
    );
  }

  // Ensure pro has not already rejected this request
  const rejectedBy = (jobRequest.rejectedBy || []).map((u) => u.toString());
  if (rejectedBy.includes(proId)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "You have already rejected this job request",
    );
  }

  // Check if pro already submitted an active quote for this job
  const existingActiveQuote = await Quotation.findOne({
    jobRequest: jobRequest._id,
    professional: new Types.ObjectId(proId),
    status: { $in: [QUOTATION_STATUS.PENDING, QUOTATION_STATUS.ACCEPTED] },
    isDeleted: { $ne: true },
  });

  if (existingActiveQuote) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      "You have already submitted an active quotation for this job request",
    );
  }

  const proUser = await User.findById(proId);
  if (!proUser || proUser.role !== USER_ROLES.PROFESSIONAL) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      "Only professionals can send quotations",
    );
  }

  // Subscription package and quotation limit guard
  await verifyQuotationSubscriptionGuard(proId);

  const quotationData: Partial<IQuotation> = {
    ...payload,
    jobRequest: jobRequest._id,
    professional: new Types.ObjectId(proId),
    homeowner: jobRequest.homeowner,
    status: QUOTATION_STATUS.PENDING,
    isHired: false,
  };

  const createdQuotation = await Quotation.create(quotationData);

  // Recalculate quotesCount for this jobRequest
  const totalQuotes = await Quotation.countDocuments({
    jobRequest: jobRequest._id,
    isDeleted: { $ne: true },
  });

  await JobRequest.findByIdAndUpdate(jobRequest._id, {
    quotesCount: totalQuotes,
    ...(jobRequest.status === JOB_REQUEST_STATUS.AWAITING_QUOTES
      ? { status: JOB_REQUEST_STATUS.QUOTED }
      : {}),
  });

  // Notify homeowner
  try {
    await sendNotifications({
      receiver: jobRequest.homeowner,
      sender: new Types.ObjectId(proId),
      title: "New Quotation Received",
      text: `${proUser.name || "A professional"} sent you a quotation of $${payload.totalRate} for "${jobRequest.headline || jobRequest.title}"`,
      type: NOTIFICATION_TYPE.HOME_OWNER,
      referenceId: createdQuotation._id,
      referenceModel: "Quotation" as any,
    });
  } catch {
    // notification failure should not block creation
  }

  realtimeSocket.quote({
    quotationId: createdQuotation._id,
    jobRequestId: jobRequest._id,
    homeownerId: jobRequest.homeowner,
    professionalId: proId,
    action: "created",
    status: createdQuotation.status,
    broadcastProfessionals: true,
  });

  const populated = await Quotation.findById(createdQuotation._id)
    .populate({
      path: "jobRequest",
      select:
        "headline title description timeframe serviceLocation propertyType estimatedBudget status",
      populate: { path: "category", select: "name icon coverImage" },
    })
    .populate("homeowner", "name email profileImage phone")
    .populate({
      path: "professional",
      select:
        "name email profileImage phone verified city state companyName about yearsOfExperience startingRate hourlyRate category",
      populate: { path: "category", select: "name icon" },
    })
    .lean();

  return await populateProfessionalRating(populated);
};

const getQuotationByIdFromDB = async (
  id: string,
  userId: string,
  userRole?: string,
) => {
  assertValidObjectId(id, "Quotation ID");

  const quotation = await Quotation.findById(id)
    .populate({
      path: "jobRequest",
      populate: [
        { path: "category", select: "name icon coverImage" },
        { path: "homeowner", select: "name email profileImage phone" },
      ],
    })
    .populate(
      "homeowner",
      "name email profileImage phone city state zipCode streetAddress",
    )
    .populate({
      path: "professional",
      select:
        "name email profileImage phone verified city state companyName about yearsOfExperience startingRate hourlyRate category tradeLicense liabilityInsurance",
      populate: { path: "category", select: "name icon" },
    })
    .lean();

  if (!quotation || (quotation as any).isDeleted) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Quotation not found");
  }

  const homeownerId =
    (quotation.homeowner as any)?._id?.toString() ||
    quotation.homeowner?.toString();
  const proId =
    (quotation.professional as any)?._id?.toString() ||
    quotation.professional?.toString();

  const isOwner = homeownerId === userId;
  const isPro = proId === userId;
  const isAdmin = isAdminRole(userRole);

  if (!isOwner && !isPro && !isAdmin) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      "You do not have permission to view this quotation",
    );
  }

  return await populateProfessionalRating(quotation);
};

const acceptQuotationToDB = async (
  id: string,
  userId: string,
  payload: {
    appointmentDate?: string | Date;
    paymentMethod?: string;
    arrivalTimeWindow?: string;
  },
) => {
  assertValidObjectId(id, "Quotation ID");

  const quotation = await Quotation.findById(id);
  if (!quotation || (quotation as any).isDeleted) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Quotation not found");
  }

  if (quotation.homeowner.toString() !== userId) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      "Only the homeowner can accept this quotation",
    );
  }

  if (quotation.status === QUOTATION_STATUS.ACCEPTED) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "This quotation has already been accepted",
    );
  }

  if (
    quotation.status === QUOTATION_STATUS.DECLINED ||
    quotation.status === QUOTATION_STATUS.REJECTED
  ) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Cannot accept a quotation that was declined",
    );
  }

  if (quotation.status === QUOTATION_STATUS.EXPIRED) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "This quotation offer has expired and can no longer be accepted",
    );
  }

  // Check if offerValidUntil has passed
  if (
    quotation.offerValidUntil &&
    new Date() > new Date(quotation.offerValidUntil)
  ) {
    quotation.status = QUOTATION_STATUS.EXPIRED;
    await quotation.save();
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `This quotation offer expired on ${new Date(quotation.offerValidUntil).toLocaleDateString()}. It can no longer be accepted.`,
    );
  }

  const jobRequest = await JobRequest.findById(quotation.jobRequest);
  if (!jobRequest || (jobRequest as any).isDeleted) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Job request not found");
  }

  if (
    jobRequest.status === JOB_REQUEST_STATUS.COMPLETED ||
    jobRequest.status === JOB_REQUEST_STATUS.CANCELLED
  ) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "This job request is no longer available",
    );
  }

  // Update Quotation to accepted and save appointment confirmation details
  quotation.status = QUOTATION_STATUS.ACCEPTED;
  quotation.isHired = true;
  quotation.acceptedAt = new Date();

  if (payload.appointmentDate) {
    quotation.appointmentDate = new Date(payload.appointmentDate);
  }
  if (payload.paymentMethod) {
    quotation.paymentMethod = payload.paymentMethod;
  }
  if (payload.arrivalTimeWindow) {
    quotation.confirmedArrivalWindow = payload.arrivalTimeWindow;
  }

  await quotation.save();

  // Update Job Request: mark IN_PROGRESS and assign professional
  jobRequest.status = JOB_REQUEST_STATUS.IN_PROGRESS;
  jobRequest.professional = quotation.professional;
  await jobRequest.save();

  // Create or update the Booking record
  await Booking.findOneAndUpdate(
    { jobRequest: quotation.jobRequest, homeowner: quotation.homeowner },
    {
      jobRequest: quotation.jobRequest,
      quotation: quotation._id,
      homeowner: quotation.homeowner,
      professional: quotation.professional,
      totalAmount: quotation.totalRate,
      appointmentDate: quotation.appointmentDate || new Date(),
      arrivalTimeWindow:
        quotation.confirmedArrivalWindow || quotation.arrivalTimeWindow,
      paymentMethod: quotation.paymentMethod || BOOKING_PAYMENT_METHOD.CASH,
      status: BOOKING_STATUS.SCHEDULED,
      isDeleted: false,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  // Automatically decline any other pending quotations for this job request
  await Quotation.updateMany(
    {
      jobRequest: quotation.jobRequest,
      _id: { $ne: quotation._id },
      status: QUOTATION_STATUS.PENDING,
    },
    {
      $set: {
        status: QUOTATION_STATUS.DECLINED,
        declineReason: "Another quotation was accepted for this job request",
        declinedAt: new Date(),
      },
    },
  );

  // Notify professional
  try {
    await sendNotifications({
      receiver: quotation.professional,
      sender: new Types.ObjectId(userId),
      title: "Quotation Accepted!",
      text: `Congratulations! Your quotation for "${jobRequest.headline || jobRequest.title}" has been accepted. You are hired!`,
      type: NOTIFICATION_TYPE.PROFESSIONAL,
      referenceId: quotation._id,
      referenceModel: "Quotation" as any,
    });
  } catch {
    // ignore notification error
  }

  realtimeSocket.quote({
    quotationId: quotation._id,
    jobRequestId: quotation.jobRequest,
    homeownerId: quotation.homeowner,
    professionalId: quotation.professional,
    action: "accepted",
    status: quotation.status,
    broadcastProfessionals: true,
  });
  realtimeSocket.booking({
    jobRequestId: quotation.jobRequest,
    homeownerId: quotation.homeowner,
    professionalId: quotation.professional,
    action: "created",
    status: BOOKING_STATUS.SCHEDULED,
    broadcastProfessionals: true,
  });

  const populated = await Quotation.findById(quotation._id)
    .populate({
      path: "jobRequest",
      populate: [
        { path: "category", select: "name icon coverImage" },
        { path: "homeowner", select: "name email profileImage phone" },
      ],
    })
    .populate("homeowner", "name email profileImage phone")
    .populate({
      path: "professional",
      select:
        "name email profileImage phone verified city state companyName about yearsOfExperience startingRate hourlyRate category",
      populate: { path: "category", select: "name icon" },
    })
    .lean();

  return await populateProfessionalRating(populated);
};

const declineQuotationToDB = async (
  id: string,
  userId: string,
  payload?: { reason?: string },
) => {
  assertValidObjectId(id, "Quotation ID");

  const quotation = await Quotation.findById(id);
  if (!quotation || (quotation as any).isDeleted) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Quotation not found");
  }

  if (quotation.homeowner.toString() !== userId) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      "Only the homeowner can decline this quotation",
    );
  }

  if (quotation.status === QUOTATION_STATUS.ACCEPTED) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Cannot decline an accepted quotation",
    );
  }

  quotation.status = QUOTATION_STATUS.DECLINED;
  quotation.declinedAt = new Date();
  if (payload?.reason) {
    quotation.declineReason = payload.reason;
  }

  await quotation.save();

  const jobRequest = await JobRequest.findById(quotation.jobRequest);

  // Notify professional
  try {
    await sendNotifications({
      receiver: quotation.professional,
      sender: new Types.ObjectId(userId),
      title: "Quotation Declined",
      text: `Your quotation for "${jobRequest?.headline || jobRequest?.title || "job request"}" was declined by the homeowner.`,
      type: NOTIFICATION_TYPE.PROFESSIONAL,
      referenceId: quotation._id,
      referenceModel: "Quotation" as any,
    });
  } catch {
    // ignore notification error
  }

  realtimeSocket.quote({
    quotationId: quotation._id,
    jobRequestId: quotation.jobRequest,
    homeownerId: quotation.homeowner,
    professionalId: quotation.professional,
    action: "declined",
    status: quotation.status,
    broadcastProfessionals: true,
  });

  const populated = await Quotation.findById(quotation._id)
    .populate({
      path: "jobRequest",
      populate: [
        { path: "category", select: "name icon coverImage" },
        { path: "homeowner", select: "name email profileImage phone" },
      ],
    })
    .populate("homeowner", "name email profileImage phone")
    .populate({
      path: "professional",
      select:
        "name email profileImage phone verified city state companyName about yearsOfExperience startingRate hourlyRate category",
      populate: { path: "category", select: "name icon" },
    })
    .lean();

  return await populateProfessionalRating(populated);
};

const getAllQuotationsFromDB = async (
  query: Record<string, unknown>,
  userId: string,
  userRole?: string,
) => {
  const normalizedQuery = { ...query };
  const baseFilter: Record<string, unknown> = {
    isDeleted: { $ne: true },
  };

  // Role scoping:
  // Homeowner sees quotes for their job requests
  // Pro sees quotes they sent
  // Admin sees all
  if (userRole === USER_ROLES.HOME_OWNER) {
    baseFilter.homeowner = new Types.ObjectId(userId);
  } else if (userRole === USER_ROLES.PROFESSIONAL) {
    baseFilter.professional = new Types.ObjectId(userId);
  }

  if (normalizedQuery.jobRequest) {
    baseFilter.jobRequest = new Types.ObjectId(
      normalizedQuery.jobRequest as string,
    );
    delete normalizedQuery.jobRequest;
  }

  const queryBuilder = new QueryBuilder(
    Quotation.find(baseFilter)
      .populate({
        path: "jobRequest",
        populate: [
          { path: "category", select: "name icon coverImage" },
          { path: "homeowner", select: "name email profileImage phone" },
        ],
      })
      .populate("homeowner", "name email profileImage phone")
      .populate({
        path: "professional",
        select:
          "name email profileImage phone verified city state companyName about yearsOfExperience startingRate hourlyRate category",
        populate: { path: "category", select: "name icon" },
      }),
    normalizedQuery,
  )
    .search(quotationSearchableFields)
    .filter()
    .sort();

  queryBuilder.paginate();

  const [data, meta] = await Promise.all([
    queryBuilder.modelQuery.lean(),
    queryBuilder.countTotal(),
  ]);

  const enrichedData = await Promise.all(
    data.map((quote: any) => populateProfessionalRating(quote)),
  );

  return { data: enrichedData, meta };
};

const getQuotationsForJobRequest = async (
  jobRequestId: string,
  viewerId?: string,
  viewerRole?: string,
) => {
  const query: Record<string, any> = {
    jobRequest: new Types.ObjectId(jobRequestId),
    isDeleted: { $ne: true },
  };

  // If viewed by a professional, only show their own quotation
  if (viewerRole === USER_ROLES.PROFESSIONAL && viewerId) {
    query.professional = new Types.ObjectId(viewerId);
  }

  const quotes = await Quotation.find(query)
    .populate({
      path: "professional",
      select:
        "name email profileImage phone verified city state companyName about yearsOfExperience startingRate hourlyRate category",
      populate: { path: "category", select: "name icon" },
    })
    .sort({ createdAt: -1 })
    .lean();

  return await Promise.all(
    quotes.map((quote: any) => populateProfessionalRating(quote)),
  );
};

export const QuotationService = {
  createQuotationToDB,
  getQuotationByIdFromDB,
  acceptQuotationToDB,
  declineQuotationToDB,
  getAllQuotationsFromDB,
  getQuotationsForJobRequest,
};
