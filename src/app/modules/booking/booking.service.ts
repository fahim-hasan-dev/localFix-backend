import mongoose, { Types } from "mongoose";
import { StatusCodes } from "http-status-codes";
import Stripe from "stripe";
import config from "../../../config";
import ApiError from "../../../errors/ApiErrors";
import QueryBuilder from "../../builder/queryBuilder";
import { sendNotifications } from "../../../helpers/notificationsHelper";
import { escapeRegex } from "../../../helpers/searchHelper";
import { getStripe } from "../../../helpers/stripeHelper";
import { getCurrencyCode } from "../../../helpers/currencyHelper";
import { NOTIFICATION_TYPE } from "../notification/notification.constant";
import { USER_ROLES } from "../../../enums/user";
import { JOB_REQUEST_STATUS } from "../../../enums/jobRequest";
import { JobRequest } from "../jobRequest/jobRequest.model";
import { User } from "../user/user.model";
import { Review } from "../review/review.model";
import { Booking } from "./booking.model";
import { realtimeSocket } from "../realtime/realtime.socket";
import { Quotation } from "../quotation/quotation.model";
import { QUOTATION_STATUS } from "../quotation/quotation.constant";
import {
  ACTIVE_ON_SITE_STATUSES,
  BOOKING_PAYMENT_METHOD,
  BOOKING_PAYMENT_STATUS,
  BOOKING_STATUS,
  HISTORY_BOOKING_STATUSES,
  UPCOMING_BOOKING_STATUSES,
  bookingSearchableFields,
  normalizePaymentMethod,
} from "./booking.constant";

const assertValidObjectId = (id: string, fieldName = "ID") => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, `Invalid ${fieldName}`);
  }
};

const isAdminRole = (role?: string) =>
  role === USER_ROLES.ADMIN || role === USER_ROLES.SUPER_ADMIN;

const populateProfessionalRating = async (booking: any) => {
  let averageRating = 0;
  let totalReviews = 0;
  const proId = booking.professional?._id || booking.professional;
  if (proId) {
    try {
      const summary = await Review.calculateAverageRating(proId);
      averageRating = summary.averageRating || 0;
      totalReviews = summary.totalReviews || 0;
    } catch {
      // ignore
    }
  }

  return {
    ...booking,
    professional:
      typeof booking.professional === "object" && booking.professional !== null
        ? {
            ...booking.professional,
            averageRating,
            totalReviews,
          }
        : booking.professional,
  };
};

const findBookingByIdOrJob = async (id: string) => {
  assertValidObjectId(id, "Booking or Job ID");
  const query = Types.ObjectId.isValid(id)
    ? {
        $or: [
          { _id: new Types.ObjectId(id) },
          { jobRequest: new Types.ObjectId(id) },
        ],
        isDeleted: { $ne: true },
      }
    : { isDeleted: { $ne: true } };

  return await Booking.findOne(query);
};

const getMyBookingsFromDB = async (
  userId: string,
  userRole?: string,
  query: Record<string, unknown> = {},
) => {
  const normalizedQuery = { ...query };
  const baseFilter: Record<string, unknown> = {
    isDeleted: { $ne: true },
  };

  if (userRole === USER_ROLES.HOME_OWNER) {
    baseFilter.homeowner = new Types.ObjectId(userId);
  } else if (userRole === USER_ROLES.PROFESSIONAL) {
    baseFilter.professional = new Types.ObjectId(userId);
  }

  // Self-healing sync: Ensure all accepted quotations have corresponding Booking records
  try {
    const userQuoteFilter: Record<string, any> = {
      status: QUOTATION_STATUS.ACCEPTED,
      isDeleted: { $ne: true },
    };
    if (userRole === USER_ROLES.HOME_OWNER) {
      userQuoteFilter.homeowner = new Types.ObjectId(userId);
    } else if (userRole === USER_ROLES.PROFESSIONAL) {
      userQuoteFilter.professional = new Types.ObjectId(userId);
    }

    const acceptedQuotes = await Quotation.find(userQuoteFilter).lean();
    for (const quote of acceptedQuotes) {
      const existing = await Booking.findOne({ quotation: quote._id });
      if (!existing) {
        await Booking.create({
          jobRequest: quote.jobRequest,
          quotation: quote._id,
          homeowner: quote.homeowner,
          professional: quote.professional,
          totalAmount: quote.totalRate,
          appointmentDate:
            quote.appointmentDate ||
            quote.earliestAvailableDate ||
            new Date(),
          arrivalTimeWindow:
            quote.confirmedArrivalWindow ||
            quote.arrivalTimeWindow ||
            "10:00 AM - 12:00 PM",
          paymentMethod: quote.paymentMethod || "Cash",
          status: BOOKING_STATUS.SCHEDULED,
        });
      }
    }
  } catch {
    // ignore
  }

  // Calculate tab counts
  const [allCount, upcomingCount, activeOnSiteCount, historyCount] =
    await Promise.all([
      Booking.countDocuments(baseFilter),
      Booking.countDocuments({
        ...baseFilter,
        status: { $in: UPCOMING_BOOKING_STATUSES },
      }),
      Booking.countDocuments({
        ...baseFilter,
        status: { $in: ACTIVE_ON_SITE_STATUSES },
      }),
      Booking.countDocuments({
        ...baseFilter,
        status: { $in: HISTORY_BOOKING_STATUSES },
      }),
    ]);

  const tabCounts = {
    all: allCount,
    upcoming: upcomingCount,
    activeOnSite: activeOnSiteCount,
    history: historyCount,
  };

  // Filter by tab if provided (default is 'all' which returns all bookings)
  let activeTab = "all";
  if (normalizedQuery.tab) {
    const tab = String(normalizedQuery.tab).toLowerCase();
    delete normalizedQuery.tab;

    if (tab === "upcoming") {
      baseFilter.status = { $in: UPCOMING_BOOKING_STATUSES };
      activeTab = "upcoming";
    } else if (
      tab === "active" ||
      tab === "active_on_site" ||
      tab === "active-on-site"
    ) {
      baseFilter.status = { $in: ACTIVE_ON_SITE_STATUSES };
      activeTab = "active_on_site";
    } else if (tab === "history") {
      baseFilter.status = { $in: HISTORY_BOOKING_STATUSES };
      activeTab = "history";
    } else {
      activeTab = "all";
    }
  }

  // Enhanced search by client name, contractor name, job headline/title, neighborhood, city
  if (normalizedQuery.searchTerm) {
    const searchTerm = String(normalizedQuery.searchTerm).trim();
    const regex = new RegExp(escapeRegex(searchTerm), "i");

    const [matchingUsers, matchingJobs] = await Promise.all([
      User.find({ name: regex }).select("_id"),
      JobRequest.find({
        $or: [
          { headline: regex },
          { title: regex },
          { "serviceLocation.city": regex },
          { "serviceLocation.address": regex },
          { "serviceLocation.zipCode": regex },
        ],
      }).select("_id"),
    ]);

    const matchingUserIds = matchingUsers.map((u) => u._id);
    const matchingJobIds = matchingJobs.map((j) => j._id);

    (baseFilter as any).$or = [
      { homeowner: { $in: matchingUserIds } },
      { professional: { $in: matchingUserIds } },
      { jobRequest: { $in: matchingJobIds } },
      { arrivalTimeWindow: regex },
      { paymentMethod: regex },
    ];

    delete normalizedQuery.searchTerm;
  }

  const queryBuilder = new QueryBuilder(
    Booking.find(baseFilter)
      .populate({
        path: "jobRequest",
        select:
          "headline title description projectPhotos timeframe serviceLocation propertyType estimatedBudget status",
        populate: { path: "category", select: "name icon coverImage" },
      })
      .populate({
        path: "quotation",
        select:
          "priceType totalRate scopeOfWork exclusions partsAndMaterialsIncluded estimatedDuration arrivalTimeWindow warranty additionalNotes status",
      })
      .populate(
        "homeowner",
        "name email profileImage phone city state zipCode streetAddress",
      )
      .populate({
        path: "professional",
        select:
          "name email profileImage phone verified city state companyName about category",
        populate: { path: "category", select: "name icon" },
      }),
    normalizedQuery,
  )
    .search(bookingSearchableFields)
    .filter()
    .sort();

  queryBuilder.paginate();

  const [data, meta] = await Promise.all([
    queryBuilder.modelQuery.lean(),
    queryBuilder.countTotal(),
  ]);

  // Batch load reviews for bookings
  const bookingIds = data.map((b: any) => b._id);
  const jobRequestIds = data
    .map((b: any) => (b.jobRequest?._id ? b.jobRequest._id : b.jobRequest))
    .filter(Boolean);

  const reviews = await Review.find({
    $or: [
      { booking: { $in: bookingIds } },
      { maintenance: { $in: [...bookingIds, ...jobRequestIds] } },
      { jobRequest: { $in: jobRequestIds } },
    ],
  })
    .populate({
      path: "tenant",
      select: "name profileImage city state",
    })
    .populate({
      path: "homeowner",
      select: "name profileImage city state",
    })
    .lean();

  const reviewMap = new Map<string, any>();
  reviews.forEach((r: any) => {
    const homeownerUser = r.homeowner || r.tenant;
    const professionalUser = r.professional || r.contractor;
    delete r.tenant;
    delete r.contractor;
    delete r.maintenance;

    const formatted = {
      ...r,
      homeowner: homeownerUser,
      professional: professionalUser,
      isReplied: Boolean(r.isReplied || (r.reply && r.reply.trim().length > 0)),
    };
    if (r.booking) reviewMap.set(r.booking.toString(), formatted);
    if (r.maintenance) reviewMap.set(r.maintenance.toString(), formatted);
    if (r.jobRequest) reviewMap.set(r.jobRequest.toString(), formatted);
  });

  const enrichedData = await Promise.all(
    data.map(async (b: any) => {
      const ratedBooking = await populateProfessionalRating(b);
      const bookingReview =
        reviewMap.get(b._id.toString()) ||
        (b.jobRequest?._id && reviewMap.get(b.jobRequest._id.toString())) ||
        null;
      return {
        ...ratedBooking,
        review: bookingReview,
        hasReviewed: Boolean(bookingReview),
      };
    }),
  );

  return { data: enrichedData, meta, tabCounts, activeTab };
};

const getBookingByIdFromDB = async (
  id: string,
  userId: string,
  userRole?: string,
) => {
  assertValidObjectId(id, "Booking or Job ID");

  const booking = await Booking.findOne({
    $or: [
      { _id: new Types.ObjectId(id) },
      { jobRequest: new Types.ObjectId(id) },
    ],
    isDeleted: { $ne: true },
  })
    .populate({
      path: "jobRequest",
      populate: [
        { path: "category", select: "name icon coverImage" },
        { path: "homeowner", select: "name email profileImage phone" },
      ],
    })
    .populate({
      path: "quotation",
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

  if (!booking) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Booking not found");
  }

  const homeownerId =
    (booking.homeowner as any)?._id?.toString() ||
    booking.homeowner?.toString();
  const proId =
    (booking.professional as any)?._id?.toString() ||
    booking.professional?.toString();

  const isOwner = homeownerId === userId;
  const isPro = proId === userId;
  const isAdmin = isAdminRole(userRole);

  if (!isOwner && !isPro && !isAdmin) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      "You do not have permission to view this booking",
    );
  }

  const enriched = await populateProfessionalRating(booking);

  // Look up review for this booking or job
  const jobRequestId =
    (booking.jobRequest as any)?._id || booking.jobRequest;

  const reviewDoc = await Review.findOne({
    $or: [
      { booking: booking._id },
      { maintenance: booking._id },
      ...(jobRequestId
        ? [{ maintenance: jobRequestId }, { jobRequest: jobRequestId }]
        : []),
    ],
  })
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
    })
    .lean();

  let review = null;
  if (reviewDoc) {
    const homeownerUser =
      (reviewDoc as any).homeowner || (reviewDoc as any).tenant;
    const professionalUser =
      (reviewDoc as any).professional || (reviewDoc as any).contractor;
    delete (reviewDoc as any).tenant;
    delete (reviewDoc as any).contractor;
    delete (reviewDoc as any).maintenance;

    review = {
      ...reviewDoc,
      homeowner: homeownerUser,
      professional: professionalUser,
      isReplied: Boolean(
        reviewDoc.isReplied ||
          (reviewDoc.reply && reviewDoc.reply.trim().length > 0),
      ),
    };
  }

  // Compute UI helper permissions
  const isUpcoming = UPCOMING_BOOKING_STATUSES.includes(booking.status as any);
  const isActiveOnSite = ACTIVE_ON_SITE_STATUSES.includes(
    booking.status as any,
  );

  const permissions = {
    canReschedule: isOwner && isUpcoming,
    canCancel: isOwner && isUpcoming,
    canStartWork:
      isPro &&
      (booking.status === BOOKING_STATUS.SCHEDULED ||
        booking.status === BOOKING_STATUS.ON_THE_WAY),
    canGoOnTheWay: isPro && booking.status === BOOKING_STATUS.SCHEDULED,
    canMarkComplete:
      isPro &&
      (booking.status === BOOKING_STATUS.IN_PROGRESS ||
        booking.status === BOOKING_STATUS.ON_THE_WAY),
    canConfirmCompletion:
      isOwner && booking.status === BOOKING_STATUS.PENDING_COMPLETION,
    canReview:
      isOwner && booking.status === BOOKING_STATUS.COMPLETED && !review,
    isUpcoming,
    isActiveOnSite,
  };

  return {
    ...enriched,
    review,
    hasReviewed: Boolean(review),
    permissions,
  };
};

const rescheduleBookingToDB = async (
  id: string,
  userId: string,
  payload: {
    appointmentDate: string | Date;
    arrivalTimeWindow: string;
    paymentMethod?: string;
  },
) => {
  const booking = await findBookingByIdOrJob(id);
  if (!booking) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Booking not found");
  }

  if (booking.homeowner.toString() !== userId) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      "Only the homeowner can reschedule this booking",
    );
  }

  // Active on-site check
  if (ACTIVE_ON_SITE_STATUSES.includes(booking.status as any)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Cannot reschedule a booking that is active on-site.",
    );
  }

  if (HISTORY_BOOKING_STATUSES.includes(booking.status as any)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Cannot reschedule a completed or cancelled booking.",
    );
  }

  // Record history
  booking.rescheduleHistory = booking.rescheduleHistory || [];
  booking.rescheduleHistory.push({
    appointmentDate: booking.appointmentDate,
    arrivalTimeWindow: booking.arrivalTimeWindow,
    paymentMethod: booking.paymentMethod,
    rescheduledAt: new Date(),
  });

  booking.appointmentDate = new Date(payload.appointmentDate);
  booking.arrivalTimeWindow = payload.arrivalTimeWindow;
  if (payload.paymentMethod) {
    booking.paymentMethod = payload.paymentMethod;
  }
  booking.rescheduledAt = new Date();

  await booking.save();

  realtimeSocket.booking({
    bookingId: booking._id,
    jobRequestId: booking.jobRequest,
    homeownerId: booking.homeowner,
    professionalId: booking.professional,
    action: "rescheduled",
    status: booking.status,
  });

  // Notify professional
  try {
    const jobRequest = await JobRequest.findById(booking.jobRequest);
    await sendNotifications({
      receiver: booking.professional,
      sender: new Types.ObjectId(userId),
      title: "Appointment Rescheduled",
      text: `Homeowner rescheduled appointment for "${jobRequest?.headline || "service"}" to ${new Date(payload.appointmentDate).toLocaleDateString()} (${payload.arrivalTimeWindow}).`,
      type: NOTIFICATION_TYPE.PROFESSIONAL,
      referenceId: booking._id,
      referenceModel: "Booking" as any,
    });
  } catch {
    // ignore
  }

  return await getBookingByIdFromDB(booking._id.toString(), userId);
};

const cancelBookingToDB = async (
  id: string,
  userId: string,
  payload?: { reason?: string },
) => {
  const booking = await findBookingByIdOrJob(id);
  if (!booking) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Booking not found");
  }

  if (booking.homeowner.toString() !== userId) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      "Only the homeowner can cancel this booking",
    );
  }

  // Active on-site check
  if (ACTIVE_ON_SITE_STATUSES.includes(booking.status as any)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Cannot cancel a booking that is active on-site.",
    );
  }

  if (HISTORY_BOOKING_STATUSES.includes(booking.status as any)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Booking is already completed or cancelled.",
    );
  }

  booking.status = BOOKING_STATUS.CANCELLED;
  booking.cancelledAt = new Date();
  booking.cancelledBy = new Types.ObjectId(userId);
  if (payload?.reason) {
    booking.cancellationReason = payload.reason;
  }

  await booking.save();

  realtimeSocket.booking({
    bookingId: booking._id,
    jobRequestId: booking.jobRequest,
    homeownerId: booking.homeowner,
    professionalId: booking.professional,
    action: "cancelled",
    status: booking.status,
    broadcastProfessionals: true,
  });

  await JobRequest.findByIdAndUpdate(booking.jobRequest, {
    status: JOB_REQUEST_STATUS.CANCELLED,
  });

  // Notify professional
  try {
    const jobRequest = await JobRequest.findById(booking.jobRequest);
    await sendNotifications({
      receiver: booking.professional,
      sender: new Types.ObjectId(userId),
      title: "Booking Cancelled",
      text: `Homeowner has cancelled the booking for "${jobRequest?.headline || "service"}". Reason: ${payload?.reason || "Not specified"}`,
      type: NOTIFICATION_TYPE.PROFESSIONAL,
      referenceId: booking._id,
      referenceModel: "Booking" as any,
    });
  } catch {
    // ignore
  }

  return await getBookingByIdFromDB(booking._id.toString(), userId);
};

// Professional: On the way (En Route)
const onTheWayToDB = async (id: string, proId: string) => {
  const booking = await findBookingByIdOrJob(id);
  if (!booking) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Booking not found");
  }

  if (booking.professional.toString() !== proId) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      "Only the assigned professional can update travel status",
    );
  }

  if (HISTORY_BOOKING_STATUSES.includes(booking.status as any)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Cannot update a completed or cancelled booking",
    );
  }

  booking.status = BOOKING_STATUS.ON_THE_WAY;
  booking.onTheWayAt = new Date();
  await booking.save();

  realtimeSocket.booking({
    bookingId: booking._id,
    jobRequestId: booking.jobRequest,
    homeownerId: booking.homeowner,
    professionalId: booking.professional,
    action: "on_the_way",
    status: booking.status,
  });

  // Notify homeowner
  try {
    const jobRequest = await JobRequest.findById(booking.jobRequest);
    await sendNotifications({
      receiver: booking.homeowner,
      sender: new Types.ObjectId(proId),
      title: "Contractor On The Way",
      text: `Your contractor is on the way for "${jobRequest?.headline || "service"}".`,
      type: NOTIFICATION_TYPE.HOME_OWNER,
      referenceId: booking._id,
      referenceModel: "Booking" as any,
    });
  } catch {
    // ignore
  }

  return await getBookingByIdFromDB(booking._id.toString(), proId);
};

// Professional: Start work directly
const startWorkToDB = async (id: string, proId: string) => {
  const booking = await findBookingByIdOrJob(id);
  if (!booking) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Booking not found");
  }

  if (booking.professional.toString() !== proId) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      "Only the assigned professional can start work",
    );
  }

  if (HISTORY_BOOKING_STATUSES.includes(booking.status as any)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Cannot start work on a completed or cancelled booking",
    );
  }

  booking.status = BOOKING_STATUS.IN_PROGRESS;
  booking.workStartedAt = new Date();
  await booking.save();

  realtimeSocket.booking({
    bookingId: booking._id,
    jobRequestId: booking.jobRequest,
    homeownerId: booking.homeowner,
    professionalId: booking.professional,
    action: "started",
    status: booking.status,
  });

  await JobRequest.findByIdAndUpdate(booking.jobRequest, {
    status: JOB_REQUEST_STATUS.IN_PROGRESS,
  });

  // Notify homeowner
  try {
    const jobRequest = await JobRequest.findById(booking.jobRequest);
    await sendNotifications({
      receiver: booking.homeowner,
      sender: new Types.ObjectId(proId),
      title: "Work Started On-Site",
      text: `Contractor has arrived on site and started work on "${jobRequest?.headline || "service"}".`,
      type: NOTIFICATION_TYPE.HOME_OWNER,
      referenceId: booking._id,
      referenceModel: "Booking" as any,
    });
  } catch {
    // ignore
  }

  return await getBookingByIdFromDB(booking._id.toString(), proId);
};

// Professional: Mark work complete
const completeWorkToDB = async (
  id: string,
  proId: string,
  payload?: { completionNote?: string },
) => {
  const booking = await findBookingByIdOrJob(id);
  if (!booking) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Booking not found");
  }

  if (booking.professional.toString() !== proId) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      "Only the assigned professional can mark work complete",
    );
  }

  // Work MUST be started before marking complete
  if (
    booking.status !== BOOKING_STATUS.IN_PROGRESS &&
    booking.status !== BOOKING_STATUS.ON_THE_WAY
  ) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "You must start work on site before marking it as complete.",
    );
  }

  booking.status = BOOKING_STATUS.PENDING_COMPLETION;
  booking.contractorCompletedAt = new Date();
  if (payload?.completionNote) {
    booking.contractorCompletionNote = payload.completionNote;
  }

  await booking.save();

  realtimeSocket.booking({
    bookingId: booking._id,
    jobRequestId: booking.jobRequest,
    homeownerId: booking.homeowner,
    professionalId: booking.professional,
    action: "work_completed",
    status: booking.status,
  });

  // Notify homeowner to inspect and confirm
  try {
    const jobRequest = await JobRequest.findById(booking.jobRequest);
    await sendNotifications({
      receiver: booking.homeowner,
      sender: new Types.ObjectId(proId),
      title: "Contractor Marked Work Completed",
      text: `Contractor has marked work completed on "${jobRequest?.headline || "service"}". Please inspect the work and confirm satisfaction.`,
      type: NOTIFICATION_TYPE.HOME_OWNER,
      referenceId: booking._id,
      referenceModel: "Booking" as any,
    });
  } catch {
    // ignore
  }

  return await getBookingByIdFromDB(booking._id.toString(), proId);
};

// Homeowner: Confirm Work Completion & Payment
const confirmCompletionToDB = async (
  id: string,
  userId: string,
  payload: {
    paymentMethod?: BOOKING_PAYMENT_METHOD | string;
    isPaidDirectly?: boolean;
    isSatisfactionConfirmed?: boolean;
  },
) => {
  const booking = await findBookingByIdOrJob(id);
  if (!booking) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Booking not found");
  }

  if (booking.homeowner.toString() !== userId) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      "Only the homeowner can confirm work completion",
    );
  }

  // Already completed & paid check
  if (
    booking.status === BOOKING_STATUS.COMPLETED &&
    booking.paymentStatus === BOOKING_PAYMENT_STATUS.PAID
  ) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "This booking is already completed and paid.",
    );
  }

  // Status must be pending completion (contractor completed work)
  if (booking.status !== BOOKING_STATUS.PENDING_COMPLETION) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Contractor has not marked work as completed yet.",
    );
  }

  const selectedMethod = payload.paymentMethod
    ? normalizePaymentMethod(payload.paymentMethod)
    : booking.paymentMethod
      ? normalizePaymentMethod(booking.paymentMethod)
      : BOOKING_PAYMENT_METHOD.CASH;

  // If Stripe online payment is selected
  if (selectedMethod === BOOKING_PAYMENT_METHOD.STRIPE) {
    const [homeowner, jobRequest] = await Promise.all([
      User.findById(userId),
      JobRequest.findById(booking.jobRequest),
    ]);

    const amount = Math.max(0, Number(booking.totalAmount) || 0);
    if (amount <= 0) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Total amount must be greater than zero for online payment",
      );
    }

    const stripe = getStripe();
    const clientUrl = config.client_url || "http://localhost:3000";
    const currency = getCurrencyCode();

    const session = await stripe.checkout.sessions.create({
      allowed_payment_method_types: ["card"],
      mode: "payment",
      customer_email: (homeowner as any)?.email || undefined,
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: `LocalFix Service: ${(jobRequest as any)?.headline || "Home Service"}`,
              description: `Payment for booking #${booking._id}`,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${clientUrl}/bookings/${booking._id}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientUrl}/bookings/${booking._id}?payment=cancelled`,
      metadata: {
        paymentType: "booking_payment",
        bookingId: booking._id.toString(),
        homeownerId: booking.homeowner.toString(),
        professionalId: booking.professional.toString(),
        jobRequestId: booking.jobRequest.toString(),
        paymentMethod: BOOKING_PAYMENT_METHOD.STRIPE,
        isSatisfactionConfirmed: String(
          payload.isSatisfactionConfirmed !== false,
        ),
        isPaidDirectly: String(Boolean(payload.isPaidDirectly)),
      },
    });

    // Update booking with pending Stripe session info.
    // Notice: status remains PENDING_COMPLETION until webhook verifies payment!
    booking.settledPaymentMethod = BOOKING_PAYMENT_METHOD.STRIPE;
    booking.paymentStatus = BOOKING_PAYMENT_STATUS.PENDING;
    booking.stripeSessionId = session.id;
    booking.stripePaymentUrl = session.url;
    booking.isSatisfactionConfirmed =
      payload.isSatisfactionConfirmed !== false;
    booking.isPaidDirectly = Boolean(payload.isPaidDirectly);

    await booking.save();

    const bookingData = await getBookingByIdFromDB(
      booking._id.toString(),
      userId,
    );

    return {
      requiresPayment: true,
      paymentMethod: BOOKING_PAYMENT_METHOD.STRIPE,
      paymentUrl: session.url,
      checkoutUrl: session.url,
      sessionId: session.id,
      ...bookingData,
      booking: bookingData,
    };
  }

  // Manual payment methods (Cash, Bank Transfer, Check, Card, etc.)
  booking.status = BOOKING_STATUS.COMPLETED;
  booking.paymentStatus = BOOKING_PAYMENT_STATUS.PAID;
  booking.homeownerCompletedAt = new Date();
  booking.paidAt = new Date();
  booking.settledPaymentMethod = selectedMethod;
  booking.isPaidDirectly = payload.isPaidDirectly !== false;
  booking.isSatisfactionConfirmed = payload.isSatisfactionConfirmed !== false;

  await booking.save();

  realtimeSocket.booking({
    bookingId: booking._id,
    jobRequestId: booking.jobRequest,
    homeownerId: booking.homeowner,
    professionalId: booking.professional,
    action: "completed",
    status: booking.status,
  });

  // Update JobRequest to completed
  await JobRequest.findByIdAndUpdate(booking.jobRequest, {
    status: JOB_REQUEST_STATUS.COMPLETED,
  });

  // Increment completedJobs on professional user
  await User.findByIdAndUpdate(booking.professional, {
    $inc: { completedJobs: 1 },
  });

  // Notify professional
  try {
    const jobRequest = await JobRequest.findById(booking.jobRequest);
    await sendNotifications({
      receiver: booking.professional,
      sender: new Types.ObjectId(userId),
      title: "Work Completion Confirmed!",
      text: `Homeowner has confirmed completion and payment (${selectedMethod}) for "${jobRequest?.headline || "service"}".`,
      type: NOTIFICATION_TYPE.PROFESSIONAL,
      referenceId: booking._id,
      referenceModel: "Booking" as any,
    });
  } catch {
    // ignore
  }

  const bookingData = await getBookingByIdFromDB(
    booking._id.toString(),
    userId,
  );

  return {
    requiresPayment: false,
    paymentMethod: selectedMethod,
    paymentUrl: null,
    checkoutUrl: null,
    sessionId: null,
    ...bookingData,
    booking: bookingData,
  };
};

// Webhook handler for Stripe Checkout Session Completion
const handleBookingPaymentCompleted = async (
  session: Stripe.Checkout.Session,
) => {
  const bookingId =
    session.metadata?.bookingId || (session.client_reference_id as string);
  if (!bookingId) {
    return;
  }

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    return;
  }

  // Idempotency: if already completed and marked paid, skip
  if (
    booking.status === BOOKING_STATUS.COMPLETED &&
    booking.paymentStatus === BOOKING_PAYMENT_STATUS.PAID
  ) {
    return;
  }

  booking.status = BOOKING_STATUS.COMPLETED;
  booking.paymentStatus = BOOKING_PAYMENT_STATUS.PAID;
  booking.homeownerCompletedAt = new Date();
  booking.paidAt = new Date();
  booking.settledPaymentMethod = BOOKING_PAYMENT_METHOD.STRIPE;
  booking.stripeSessionId = session.id;
  if (session.payment_intent) {
    booking.stripePaymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent.id;
  }
  booking.isPaidDirectly = session.metadata?.isPaidDirectly === "true";
  booking.isSatisfactionConfirmed =
    session.metadata?.isSatisfactionConfirmed !== "false";

  await booking.save();

  realtimeSocket.booking({
    bookingId: booking._id,
    jobRequestId: booking.jobRequest,
    homeownerId: booking.homeowner,
    professionalId: booking.professional,
    action: "paid",
    status: booking.status,
  });

  // Update JobRequest to completed
  await JobRequest.findByIdAndUpdate(booking.jobRequest, {
    status: JOB_REQUEST_STATUS.COMPLETED,
  });

  // Increment completedJobs on professional user
  await User.findByIdAndUpdate(booking.professional, {
    $inc: { completedJobs: 1 },
  });

  // Notify professional and homeowner
  try {
    const jobRequest = await JobRequest.findById(booking.jobRequest);
    const amountStr = session.amount_total
      ? `${(session.amount_total / 100).toFixed(2)} ${session.currency?.toUpperCase() || ""}`
      : `${booking.totalAmount}`;

    await sendNotifications({
      receiver: booking.professional,
      sender: booking.homeowner,
      title: "Work Completion & Payment Confirmed!",
      text: `Homeowner has completed payment of ${amountStr} via Stripe for "${jobRequest?.headline || "service"}".`,
      type: NOTIFICATION_TYPE.PROFESSIONAL,
      referenceId: booking._id,
      referenceModel: "Booking" as any,
    });

    await sendNotifications({
      receiver: booking.homeowner,
      sender: booking.professional,
      title: "Payment Successful",
      text: `Your payment of ${amountStr} for "${jobRequest?.headline || "service"}" was successful. Thank you!`,
      type: NOTIFICATION_TYPE.HOME_OWNER,
      referenceId: booking._id,
      referenceModel: "Booking" as any,
    });
  } catch {
    // ignore
  }
};

// Webhook handler for Stripe PaymentIntent Succeeded
const handlePaymentIntentSucceeded = async (
  paymentIntent: Stripe.PaymentIntent,
) => {
  const bookingId = paymentIntent.metadata?.bookingId;
  if (!bookingId) {
    return;
  }

  const booking = await Booking.findById(bookingId);
  if (!booking) return;

  if (
    booking.status === BOOKING_STATUS.COMPLETED &&
    booking.paymentStatus === BOOKING_PAYMENT_STATUS.PAID
  ) {
    return;
  }

  booking.status = BOOKING_STATUS.COMPLETED;
  booking.paymentStatus = BOOKING_PAYMENT_STATUS.PAID;
  booking.homeownerCompletedAt = new Date();
  booking.paidAt = new Date();
  booking.settledPaymentMethod = BOOKING_PAYMENT_METHOD.STRIPE;
  booking.stripePaymentIntentId = paymentIntent.id;

  await booking.save();

  realtimeSocket.booking({
    bookingId: booking._id,
    jobRequestId: booking.jobRequest,
    homeownerId: booking.homeowner,
    professionalId: booking.professional,
    action: "paid",
    status: booking.status,
  });

  await JobRequest.findByIdAndUpdate(booking.jobRequest, {
    status: JOB_REQUEST_STATUS.COMPLETED,
  });

  await User.findByIdAndUpdate(booking.professional, {
    $inc: { completedJobs: 1 },
  });
};

// Homeowner/Professional: Verify Payment Status with Stripe (Sync / Fallback)
const verifyBookingPaymentToDB = async (id: string, userId: string) => {
  const booking = await findBookingByIdOrJob(id);
  if (!booking) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Booking not found");
  }

  const homeownerId = booking.homeowner.toString();
  const proId = booking.professional.toString();

  if (homeownerId !== userId && proId !== userId) {
    throw new ApiError(StatusCodes.FORBIDDEN, "Access denied");
  }

  // If already completed & paid, return latest state
  if (
    booking.status === BOOKING_STATUS.COMPLETED &&
    booking.paymentStatus === BOOKING_PAYMENT_STATUS.PAID
  ) {
    return await getBookingByIdFromDB(booking._id.toString(), userId);
  }

  // If Stripe session exists and status is still pending, verify with Stripe
  if (booking.stripeSessionId) {
    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(
        booking.stripeSessionId,
      );

      if (session.payment_status === "paid") {
        await handleBookingPaymentCompleted(session);
      }
    } catch {
      // ignore
    }
  }

  return await getBookingByIdFromDB(booking._id.toString(), userId);
};

export const BookingService = {
  getMyBookingsFromDB,
  getBookingByIdFromDB,
  rescheduleBookingToDB,
  cancelBookingToDB,
  onTheWayToDB,
  startWorkToDB,
  completeWorkToDB,
  confirmCompletionToDB,
  handleBookingPaymentCompleted,
  handlePaymentIntentSucceeded,
  verifyBookingPaymentToDB,
};
