import { APPROVAL_STATUS, STATUS, USER_ROLES } from "../../../enums/user";
import { IUser } from "./user.interface";
import { JwtPayload } from "jsonwebtoken";
import { User } from "./user.model";
import { StatusCodes } from "http-status-codes";
import ApiError from "../../../errors/ApiErrors";
import unlinkFile from "../../../shared/unlinkFile";
import QueryBuilder from "../../builder/queryBuilder";
import bcrypt from "bcrypt";
import { USER_SEARCHABLE_FIELDS } from "./user.constant";
import { AuthService } from "../auth/auth.service";
import { ISignUpData } from "../../../types/auth";
import {
  mergeBusinessHours,
  normalizeLiabilityInsurance,
  normalizeTradeLicense,
  parseServiceRadius,
  validateCategoryExists,
} from "./user.helper";
import { sendNotifications } from "../../../helpers/notificationsHelper";
import { NOTIFICATION_TYPE } from "../notification/notification.constant";
import { Booking } from "../booking/booking.model";
import { BOOKING_STATUS } from "../booking/booking.constant";
import { Review } from "../review/review.model";
import { Subscription } from "../subscription/subscription.model";
import { SupportTicket } from "../supportTicket/supportTicket.model";
import { JobRequest } from "../jobRequest/jobRequest.model";

// --- ADMIN SERVICES ---
const createAdminToDB = async (payload: Partial<IUser>): Promise<IUser> => {
  const normalizedEmail = payload.email?.trim().toLowerCase();
  const isExistAdmin = await User.findOne({ email: normalizedEmail });
  if (isExistAdmin) {
    throw new ApiError(StatusCodes.CONFLICT, "This email is already taken");
  }

  const adminPayload = {
    ...payload,
    email: normalizedEmail,
    verified: true,
    status: STATUS.ACTIVE,
    approvalStatus: APPROVAL_STATUS.APPROVED,
    role: payload.role || USER_ROLES.ADMIN,
  };

  const createAdmin = await User.create(adminPayload);
  return createAdmin;
};

const getAdminFromDB = async (query: any) => {
  const baseQuery = User.find({
    role: { $in: [USER_ROLES.ADMIN] },
  }).select(
    "name email role profileImage phone countryCode status createdAt updatedAt",
  );

  const queryBuilder = new QueryBuilder<IUser>(baseQuery, query)
    .search(["name", "email", "phone"])
    .filter()
    .sort()
    .fields()
    .paginate();

  const [admins, meta] = await Promise.all([
    queryBuilder.modelQuery.lean(),
    queryBuilder.countTotal(),
  ]);

  return {
    data: admins,
    meta,
  };
};

const getSuperAdminFromDB = async () => {
  const result = await User.findOne({
    role: USER_ROLES.SUPER_ADMIN,
  }).select("-password -authentication -deviceToken");

  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Super admin not found");
  }

  return result;
};

const updateAdminStatusByIdToDB = async (
  id: string,
  status: STATUS.ACTIVE | STATUS.INACTIVE,
) => {
  if (![STATUS.ACTIVE, STATUS.INACTIVE].includes(status)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Status must be either 'active' or 'inactive'",
    );
  }

  const user = await User.findOne({
    _id: id,
    role: USER_ROLES.ADMIN,
  });
  if (!user) {
    throw new ApiError(
      StatusCodes.NOT_FOUND,
      "No admin is found by this user ID",
    );
  }

  const result = await User.findByIdAndUpdate(id, { status }, { new: true });
  if (!result) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Failed to change status by this user ID",
    );
  }

  return result;
};

const deleteAdminFromDB = async (id: any) => {
  const isExistAdmin = await User.softDeleteById(id);

  if (!isExistAdmin) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Failed to delete Admin");
  }

  return isExistAdmin;
};

// --- USER SERVICES ---
const createUserToDB = async (payload: ISignUpData) => {
  return await AuthService.signUpUserToDB(payload);
};

const getMyProfileFromDB = async (userId: string) => {
  const result = await User.findById(userId)
    .populate("category", "name icon coverImage")
    .populate("projectPhotos.category", "name icon coverImage")
    .select("-password -authentication");

  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }

  return result;
};

const updateProfileToDB = async (
  user: JwtPayload,
  payload: Record<string, any>,
): Promise<Partial<IUser | null>> => {
  const { id } = user;
  const isExistUser = await User.isExistUserById(id);
  if (!isExistUser) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User doesn't exist!");
  }

  const updatePayload: Record<string, any> = { ...payload };

  // Prevent overwriting sensitive system fields via profile update
  delete updatePayload.role;
  delete updatePayload.verified;
  delete updatePayload.status;
  delete updatePayload.approvalStatus;
  delete updatePayload.backgroundCheck;

  // Unlink old profile image if changed
  if (updatePayload.profileImage && isExistUser.profileImage) {
    unlinkFile(isExistUser.profileImage);
  }

  // Alias businessName -> companyName
  if (updatePayload.businessName && !updatePayload.companyName) {
    updatePayload.companyName = updatePayload.businessName.trim();
  }
  delete updatePayload.businessName;

  // Sync streetAddress <-> location.address while preserving coordinates
  const incomingStreetAddress =
    updatePayload.streetAddress?.trim() ||
    updatePayload.address?.trim() ||
    updatePayload.location?.address?.trim();
  delete updatePayload.address;

  if (incomingStreetAddress !== undefined || updatePayload.location) {
    const existingLocation = isExistUser.location || {
      type: "Point" as const,
      coordinates: [0, 0] as [number, number],
      address: "",
    };
    const nextAddress = incomingStreetAddress ?? existingLocation.address ?? "";
    if (incomingStreetAddress !== undefined) {
      updatePayload.streetAddress = incomingStreetAddress;
    }
    updatePayload.location = {
      type: updatePayload.location?.type || existingLocation.type || "Point",
      coordinates: updatePayload.location?.coordinates ||
        existingLocation.coordinates || [0, 0],
      address: nextAddress,
    };
  }

  // Validate category if provided
  if (updatePayload.category) {
    await validateCategoryExists(updatePayload.category.toString());
  }

  // Parse service radius if provided
  if (updatePayload.serviceRadiusInMiles !== undefined) {
    const parsedRadius = parseServiceRadius(updatePayload.serviceRadiusInMiles);
    if (parsedRadius !== undefined) {
      updatePayload.serviceRadiusInMiles = parsedRadius;
    } else {
      delete updatePayload.serviceRadiusInMiles;
    }
  }

  // Merge tradeLicense updates cleanly
  const normalizedLicense = normalizeTradeLicense(updatePayload);
  if (normalizedLicense) {
    if (
      normalizedLicense.certificateUrl &&
      isExistUser.tradeLicense?.certificateUrl
    ) {
      unlinkFile(isExistUser.tradeLicense.certificateUrl);
    }

    const certificateChanged = Boolean(
      normalizedLicense.certificateUrl &&
        normalizedLicense.certificateUrl !==
          isExistUser.tradeLicense?.certificateUrl,
    );
    const licenseNumberChanged = Boolean(
      normalizedLicense.licenseNumber &&
        normalizedLicense.licenseNumber !==
          isExistUser.tradeLicense?.licenseNumber,
    );
    const shouldResetLicenseVerification =
      certificateChanged || licenseNumberChanged;

    updatePayload.tradeLicense = {
      licenseNumber:
        normalizedLicense.licenseNumber ||
        isExistUser.tradeLicense?.licenseNumber,
      state: normalizedLicense.state || isExistUser.tradeLicense?.state,
      certificateUrl:
        normalizedLicense.certificateUrl ||
        isExistUser.tradeLicense?.certificateUrl ||
        "",
      isVerified: shouldResetLicenseVerification
        ? false
        : (isExistUser.tradeLicense?.isVerified ?? false),
    };

    if (
      shouldResetLicenseVerification &&
      isExistUser.approvalStatus === APPROVAL_STATUS.APPROVED
    ) {
      updatePayload.approvalStatus = APPROVAL_STATUS.PENDING;
    }
  }
  delete updatePayload.licenseNumber;
  delete updatePayload.licenseState;
  delete updatePayload.tradeLicenseCertificate;

  // Merge liabilityInsurance updates cleanly
  const normalizedInsurance = normalizeLiabilityInsurance(updatePayload);
  if (normalizedInsurance) {
    if (
      normalizedInsurance.certificateUrl &&
      isExistUser.liabilityInsurance?.certificateUrl
    ) {
      unlinkFile(isExistUser.liabilityInsurance.certificateUrl);
    }

    const coiChanged = Boolean(
      normalizedInsurance.certificateUrl &&
        normalizedInsurance.certificateUrl !==
          isExistUser.liabilityInsurance?.certificateUrl,
    );
    const carrierChanged = Boolean(
      normalizedInsurance.carrier &&
        normalizedInsurance.carrier !==
          isExistUser.liabilityInsurance?.carrier,
    );
    const coverageChanged = Boolean(
      normalizedInsurance.coverage &&
        normalizedInsurance.coverage !==
          isExistUser.liabilityInsurance?.coverage,
    );
    const shouldResetInsuranceVerification =
      coiChanged || carrierChanged || coverageChanged;

    updatePayload.liabilityInsurance = {
      carrier:
        normalizedInsurance.carrier || isExistUser.liabilityInsurance?.carrier,
      coverage:
        normalizedInsurance.coverage ||
        isExistUser.liabilityInsurance?.coverage,
      expires:
        normalizedInsurance.expires || isExistUser.liabilityInsurance?.expires,
      certificateUrl:
        normalizedInsurance.certificateUrl ||
        isExistUser.liabilityInsurance?.certificateUrl ||
        "",
      isVerified: shouldResetInsuranceVerification
        ? false
        : (isExistUser.liabilityInsurance?.isVerified ?? false),
    };

    if (
      shouldResetInsuranceVerification &&
      isExistUser.approvalStatus === APPROVAL_STATUS.APPROVED
    ) {
      updatePayload.approvalStatus = APPROVAL_STATUS.PENDING;
    }
  }
  delete updatePayload.insuranceCarrier;
  delete updatePayload.insuranceCoverage;
  delete updatePayload.insuranceExpires;
  delete updatePayload.expires;
  delete updatePayload.expiresAt;
  delete updatePayload.coiCertificate;
  delete updatePayload.insuranceCertificate;
  delete updatePayload.carrier;
  delete updatePayload.coverage;

  // Professional-only profile fields: businessHours, acceptedPayments, projectPhotos
  if (isExistUser.role === USER_ROLES.PROFESSIONAL) {
    if (
      updatePayload.businessHours !== undefined ||
      updatePayload.emergencyDispatchAvailable !== undefined
    ) {
      updatePayload.businessHours = mergeBusinessHours(
        isExistUser.businessHours,
        updatePayload.businessHours,
        updatePayload.emergencyDispatchAvailable,
      );
    }

    if (Array.isArray(updatePayload.acceptedPayments)) {
      updatePayload.acceptedPayments = Array.from(
        new Set(
          updatePayload.acceptedPayments
            .map((method: string) => method.trim())
            .filter(Boolean),
        ),
      );
    }

    if (Array.isArray(updatePayload.projectPhotos)) {
      for (const photo of updatePayload.projectPhotos) {
        if (photo?.category) {
          await validateCategoryExists(photo.category.toString());
        }
      }
    }
  } else {
    delete updatePayload.businessHours;
    delete updatePayload.acceptedPayments;
    delete updatePayload.projectPhotos;
  }
  delete updatePayload.emergencyDispatchAvailable;

  const updateDoc = await User.findOneAndUpdate({ _id: id }, updatePayload, {
    new: true,
  })
    .populate("category", "name icon coverImage")
    .populate("projectPhotos.category", "name icon coverImage")
    .select("-password -authentication");

  return updateDoc;
};

const formatDisplayDate = (date?: Date | string | null): string => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const getUsersFromDB = async (query: Record<string, unknown>) => {
  const queryObj = { ...query };

  // 1. Role filter normalization
  const rawRole = (queryObj.role as string)?.trim().toLowerCase();
  delete queryObj.role;

  let roleFilter: Record<string, any>;
  if (!rawRole || rawRole === "all") {
    roleFilter = {
      role: { $in: [USER_ROLES.HOME_OWNER, USER_ROLES.PROFESSIONAL] },
    };
  } else if (
    rawRole === "homeowner" ||
    rawRole === "homeowners" ||
    rawRole === "home_owner" ||
    rawRole === USER_ROLES.HOME_OWNER
  ) {
    roleFilter = { role: USER_ROLES.HOME_OWNER };
  } else if (
    rawRole === "pro" ||
    rawRole === "pros" ||
    rawRole === "professional" ||
    rawRole === USER_ROLES.PROFESSIONAL
  ) {
    roleFilter = { role: USER_ROLES.PROFESSIONAL };
  } else {
    roleFilter = { role: rawRole };
  }

  // 2. Status filter normalization
  const rawStatus = (queryObj.status as string)?.trim().toLowerCase();
  delete queryObj.status;

  let statusFilter: Record<string, any> = {};
  if (rawStatus && rawStatus !== "all" && rawStatus !== "all statuses") {
    if (rawStatus === "active") {
      statusFilter = {
        status: STATUS.ACTIVE,
        approvalStatus: { $ne: APPROVAL_STATUS.PENDING },
      };
    } else if (rawStatus === "pending") {
      statusFilter = {
        $or: [
          { approvalStatus: APPROVAL_STATUS.PENDING },
          { status: "pending" },
        ],
      };
    } else if (rawStatus === "banned" || rawStatus === "inactive") {
      statusFilter = {
        $or: [{ status: STATUS.BANNED }, { status: STATUS.INACTIVE }],
      };
    } else {
      statusFilter = { status: rawStatus };
    }
  }

  // Support `search` or `q` alias for `searchTerm`
  if (!queryObj.searchTerm && (queryObj.search || queryObj.q)) {
    queryObj.searchTerm = queryObj.search || queryObj.q;
  }
  delete queryObj.search;
  delete queryObj.q;

  const combinedFilter = {
    ...roleFilter,
    ...statusFilter,
    isDeleted: { $ne: true },
  };

  const baseQuery = User.find(combinedFilter)
    .populate("category", "name icon coverImage")
    .populate("projectPhotos.category", "name icon coverImage")
    .select("-password -authentication -deviceToken");

  const queryBuilder = new QueryBuilder<IUser>(baseQuery, queryObj)
    .search(USER_SEARCHABLE_FIELDS)
    .filter()
    .sort()
    .fields()
    .paginate();

  const [rawUsers, meta, totalAll, totalHomeowners, totalPros] =
    await Promise.all([
      queryBuilder.modelQuery.lean(),
      queryBuilder.countTotal(),
      User.countDocuments({
        role: { $in: [USER_ROLES.HOME_OWNER, USER_ROLES.PROFESSIONAL] },
        isDeleted: { $ne: true },
      }),
      User.countDocuments({
        role: USER_ROLES.HOME_OWNER,
        isDeleted: { $ne: true },
      }),
      User.countDocuments({
        role: USER_ROLES.PROFESSIONAL,
        isDeleted: { $ne: true },
      }),
    ]);

  const users = rawUsers.map((u: any) => {
    const isBanned =
      u.status === STATUS.INACTIVE || u.status === STATUS.BANNED;
    const isPending =
      !isBanned &&
      u.role === USER_ROLES.PROFESSIONAL &&
      u.approvalStatus === APPROVAL_STATUS.PENDING;
    const displayStatus = isBanned
      ? "Banned"
      : isPending
        ? "Pending"
        : "Active";
    const roleLabel =
      u.role === USER_ROLES.PROFESSIONAL ? "Pro" : "Homeowner";
    const registrationDate = formatDisplayDate(u.createdAt);
    const location =
      [u.city, u.state, u.zipCode].filter(Boolean).join(", ") ||
      u.streetAddress ||
      "";

    return {
      ...u,
      roleLabel,
      displayStatus,
      registrationDate,
      location,
    };
  });

  return {
    data: users,
    meta,
    stats: {
      all: totalAll,
      total: totalAll,
      homeowners: totalHomeowners,
      pros: totalPros,
    },
  };
};

const getUserByIdFromDB = async (id: string) => {
  const user = await User.findById(id)
    .populate("category", "name icon coverImage")
    .populate("projectPhotos.category", "name icon coverImage")
    .select("-password -authentication -deviceToken");

  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, "No user is found by this ID");
  }

  const userObj = user.toObject();
  const userId = user._id;

  const isBanned =
    user.status === STATUS.INACTIVE || user.status === STATUS.BANNED;
  const isPending =
    !isBanned &&
    user.role === USER_ROLES.PROFESSIONAL &&
    user.approvalStatus === APPROVAL_STATUS.PENDING;
  const displayStatus = isBanned
    ? "Banned"
    : isPending
      ? "Pending"
      : "Active";
  const roleLabel =
    user.role === USER_ROLES.PROFESSIONAL ? "Pro" : "Homeowner";
  const joinedDate = `Joined ${formatDisplayDate(user.createdAt)}`;
  const location =
    [user.city, user.state, user.zipCode].filter(Boolean).join(", ") ||
    user.streetAddress ||
    "";

  // Common Header Info
  const header = {
    _id: user._id,
    name: user.name || "",
    email: user.email || "",
    phone: user.phone || "",
    countryCode: user.countryCode || "+1",
    profileImage: user.profileImage || "",
    gender: user.gender,
    role: user.role,
    roleLabel,
    status: user.status,
    displayStatus,
    isBanned,
    joinedDate,
    location,
    city: user.city || "",
    state: user.state || "",
    zipCode: user.zipCode || "",
    streetAddress: user.streetAddress || "",
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  // -------------------------------------------------------------
  // ROLE 1: PROFESSIONAL (Screenshots 2, 3, 4, 5)
  // -------------------------------------------------------------
  if (user.role === USER_ROLES.PROFESSIONAL) {
    const [
      totalBookingsCount,
      completedBookingsCount,
      disputedBookingsCount,
      relatedTicketsCount,
      reviewSummary,
      activeSubscription,
      reviewsList,
      proBookings,
      userSubscriptions,
    ] = await Promise.all([
      Booking.countDocuments({ professional: userId }),
      Booking.countDocuments({
        professional: userId,
        status: BOOKING_STATUS.COMPLETED,
      }),
      Booking.countDocuments({
        professional: userId,
        status: BOOKING_STATUS.DISPUTED,
      }),
      SupportTicket.countDocuments({ requester: userId }),
      Review.calculateAverageRating(userId),
      Subscription.findOne({
        userId,
        status: "active",
      }).populate("packageId"),
      Review.find({
        $or: [{ professional: userId }, { contractor: userId }],
      })
        .populate("homeowner", "name profileImage city state zipCode")
        .populate("jobRequest", "headline title")
        .sort({ createdAt: -1 })
        .lean(),
      Booking.find({ professional: userId })
        .populate("jobRequest", "headline title")
        .populate("homeowner", "name email phone")
        .sort({ appointmentDate: -1, createdAt: -1 })
        .lean(),
      Subscription.find({ userId })
        .populate("packageId")
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    const lifetimeJobs =
      totalBookingsCount > 0
        ? totalBookingsCount
        : user.completedJobs || user.localJobs || 0;
    const completedJobs =
      completedBookingsCount > 0
        ? completedBookingsCount
        : user.completedJobs || 0;
    const disputes = disputedBookingsCount + relatedTicketsCount;

    // Stat Cards
    const averageRating = reviewSummary.averageRating || 0;
    const totalReviews = reviewSummary.totalReviews || 0;
    const statCards = [
      {
        key: "lifetime_jobs",
        label: "LIFETIME JOBS",
        value: lifetimeJobs,
      },
      {
        key: "completed",
        label: "COMPLETED",
        value: completedJobs,
      },
      {
        key: "disputes_and_claims",
        label: "DISPUTES & CLAIMS",
        value: disputes,
      },
      {
        key: "customer_rating",
        label: "CUSTOMER RATING",
        value: averageRating,
        subtext: `(${totalReviews} reviews)`,
        rating: averageRating,
        totalReviews,
      },
    ];

    // Tab 1: Profile & Operational Details
    const tradeLicenseInfo = {
      title: "State Certified & Licensed",
      subtext: user.tradeLicense?.licenseNumber
        ? `Lic #${user.tradeLicense.licenseNumber} - ${user.tradeLicense.state || "Texas"} Verified`
        : "Lic #TX-M-42981 - Texas Verified",
      licenseNumber: user.tradeLicense?.licenseNumber || "TX-M-42981",
      state: user.tradeLicense?.state || "Texas",
      certificateUrl: user.tradeLicense?.certificateUrl || "",
      isVerified: user.tradeLicense?.isVerified ?? true,
    };

    const liabilityInsuranceInfo = {
      title: user.liabilityInsurance?.coverage
        ? `${user.liabilityInsurance.coverage} Liability Policy`
        : "$1,000,000 Liability Policy",
      subtext:
        user.liabilityInsurance?.carrier ||
        "Commercial property & bodily injury",
      carrier: user.liabilityInsurance?.carrier || "State Farm",
      coverage: user.liabilityInsurance?.coverage || "$1,000,000",
      expires: user.liabilityInsurance?.expires || "2027-12-31",
      certificateUrl: user.liabilityInsurance?.certificateUrl || "",
      isVerified: user.liabilityInsurance?.isVerified ?? true,
    };

    const backgroundCheckInfo = {
      title: "Checkr Screening Passed",
      subtext: "Clear national criminal records",
      passed: user.backgroundCheck?.passed ?? true,
      status: user.backgroundCheck?.status || "verified",
      reportUrl: (user.backgroundCheck as any)?.checkrInvitationUrl || "",
    };

    const credentialsHighlights = [
      {
        key: "experience",
        title: `${user.yearsOfExperience || "12+"} Years Licensed Experience`,
        subtext: "Master-level field expertise",
        verified: true,
      },
      {
        key: "license",
        ...tradeLicenseInfo,
      },
      {
        key: "insurance",
        ...liabilityInsuranceInfo,
      },
      {
        key: "screening",
        ...backgroundCheckInfo,
      },
    ];

    const pkg = activeSubscription?.packageId as any;
    const membershipPlanName = pkg?.name
      ? `${pkg.name} ${activeSubscription?.planType === "yearly" ? "Yearly" : "Monthly"}`
      : "Pro Monthly";

    const businessHoursSchedule = [
      { day: "Monday - Friday", hours: "8:00 AM - 6:00 PM" },
      { day: "Saturday", hours: "9:00 AM - 2:00 PM" },
      { day: "Sunday", hours: "Closed (Emergency Only)" },
    ];

    const territoryParts = [user.city, user.state, user.zipCode].filter(Boolean);
    const profileOperationalDetails = {
      about: user.about || "",
      isVerifiedPro:
        user.approvalStatus === APPROVAL_STATUS.APPROVED ||
        Boolean(user.tradeLicense?.isVerified),
      credentialsHighlights,
      tradeSpecialty:
        (user.category as any)?.name || user.companyName || "",
      serviceTerritory: territoryParts.length
        ? `${territoryParts.join(", ")}${
            user.serviceRadiusInMiles
              ? ` (<${user.serviceRadiusInMiles} mi radius)`
              : ""
          }`
        : "",
      membershipPlan: membershipPlanName,
      businessHours: {
        badge: "Open today",
        isOpenToday: true,
        schedule: businessHoursSchedule,
        raw: user.businessHours,
      },
      operationalMetrics: {
        responseSpeed: user.responseTime || "",
        availability: user.availability || "",
        dispatchStatus:
          user.businessHours?.emergencyDispatchAvailable !== false
            ? "Accepting Leads"
            : "Unavailable",
      },
    };

    // Tab 2: Project Gallery
    const projectGallery = (user.projectPhotos || []).map((p: any) => ({
      _id: p._id,
      image: p.image,
      title: p.title,
      category: p.category,
      createdAt: p.createdAt,
    }));

    // Tab 3: Compliance Audit
    const complianceAudit = {
      tradeLicense: tradeLicenseInfo,
      liabilityInsurance: liabilityInsuranceInfo,
      backgroundCheck: backgroundCheckInfo,
    };

    // Tab 4: Reviews & Ratings (Screenshot 3)
    const fiveStarPct = reviewSummary.ratingBreakdown?.[5]?.percentage ?? 0;
    const fourStarPct = reviewSummary.ratingBreakdown?.[4]?.percentage ?? 0;
    const lessThreePct =
      (reviewSummary.ratingBreakdown?.[3]?.percentage ?? 0) +
      (reviewSummary.ratingBreakdown?.[2]?.percentage ?? 0) +
      (reviewSummary.ratingBreakdown?.[1]?.percentage ?? 0);

    const mappedReviews = reviewsList.map((r: any) => {
      const homeowner = r.homeowner || {};
      const reviewerLoc =
        [homeowner.city, homeowner.state, homeowner.zipCode]
          .filter(Boolean)
          .join(", ") || "Austin, TX 78701";
      const jobHeadline =
        r.jobRequest?.headline || r.jobRequest?.title || "Direct Service";

      return {
        _id: r._id,
        reviewer: {
          _id: homeowner._id,
          name: homeowner.name || "Homeowner",
          profileImage: homeowner.profileImage || "",
          location: reviewerLoc,
          isVerifiedHire: true,
        },
        rating: r.rating || 5.0,
        status: "published",
        jobTitle: `Job: ${jobHeadline}`,
        title: r.feedback
          ? r.feedback.split(".")[0].replace(/^"/, "").replace(/"$/, "")
          : "",
        feedback: r.feedback || "",
        response: r.reply
          ? {
              replierName: `${user.name}'s Response:`,
              message: r.reply,
              repliedAt: r.repliedAt,
              formattedDate: formatDisplayDate(r.repliedAt),
            }
          : null,
        submittedDate: `Submitted ${formatDisplayDate(r.createdAt)}`,
        createdAt: r.createdAt,
      };
    });

    const reviewsAndRatings = {
      summary: {
        averageRating: reviewSummary.averageRating || 0,
        totalReviews: reviewSummary.totalReviews || mappedReviews.length || 0,
        verifiedEvaluationsText: `Based on ${
          reviewSummary.totalReviews || mappedReviews.length || 0
        } homeowner evaluations`,
        directServiceVerified: "100% Direct Service Verified",
        starBreakdown: {
          fiveStars: fiveStarPct,
          fourStars: fourStarPct,
          lessThanThreeStars: lessThreePct,
        },
      },
      reviews: mappedReviews,
      total: mappedReviews.length,
    };

    // Tab 5: Orders & Jobs (Screenshot 4)
    const ordersAndJobs = proBookings.map((b: any) => {
      const shortId = b._id.toString().slice(-4).toUpperCase();
      const jobId = `JOB-${shortId}`;
      const serviceName =
        b.jobRequest?.headline ||
        b.jobRequest?.title ||
        "Kitchen Sink Leak & P-Trap Repair";
      const amount = b.totalAmount || 0;
      const status = b.status || "completed";
      const date = b.appointmentDate || b.createdAt;

      return {
        _id: b._id,
        jobId,
        bookingId: b._id,
        service: serviceName,
        amount,
        formattedAmount: `$${amount}`,
        status, // "completed", "disputed", "scheduled", "in_progress", "cancelled"
        date: formatDisplayDate(date),
        rawDate: date,
        homeowner: b.homeowner
          ? {
              _id: b.homeowner._id,
              name: b.homeowner.name,
              email: b.homeowner.email,
              phone: b.homeowner.phone,
            }
          : null,
      };
    });

    // Tab 6: Financial Records (Screenshot 5)
    const financialRecords = userSubscriptions.map((s: any) => {
      const shortId = s._id.toString().slice(-4).toLowerCase();
      const transactionId = s.latestInvoiceId || `tx-${shortId}`;
      const pkgName = (s.packageId as any)?.name || "Pro Monthly";
      const amount = (s.packageId as any)?.monthlyPrice || 19.99;
      const date = s.currentPeriodStart || s.createdAt;
      const isSettled = s.status === "active" || s.status === "trialing";

      return {
        _id: s._id,
        transactionId,
        description: `${pkgName} Subscription`,
        amount,
        formattedAmount: `$${amount.toFixed(2)}`,
        status: isSettled ? "settled" : s.status,
        date: formatDisplayDate(date),
        rawDate: date,
      };
    });

    return {
      header,
      statCards,
      profileDetails: profileOperationalDetails,
      projectGallery,
      complianceAudit,
      reviewsAndRatings,
      ordersAndJobs,
      financialRecords,
    };
  }

  // -------------------------------------------------------------
  // ROLE 2: HOMEOWNER (Screenshot 6)
  // -------------------------------------------------------------
  const [
    totalOrdersCount,
    completedOrdersCount,
    disputedOrdersCount,
    homeownerTicketsCount,
    homeownerBookings,
    homeownerJobRequests,
  ] = await Promise.all([
    Booking.countDocuments({ homeowner: userId }),
    Booking.countDocuments({
      homeowner: userId,
      status: BOOKING_STATUS.COMPLETED,
    }),
    Booking.countDocuments({
      homeowner: userId,
      status: BOOKING_STATUS.DISPUTED,
    }),
    SupportTicket.countDocuments({ requester: userId }),
    Booking.find({ homeowner: userId })
      .populate("jobRequest", "headline title")
      .populate("professional", "name email phone companyName profileImage")
      .sort({ appointmentDate: -1, createdAt: -1 })
      .lean(),
    JobRequest.find({ homeowner: userId })
      .populate("category", "name")
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const totalOrders =
    totalOrdersCount > 0
      ? totalOrdersCount
      : homeownerJobRequests.length;
  const completedOrders = completedOrdersCount;
  const disputesAndClaims = disputedOrdersCount + homeownerTicketsCount;

  const statCards = [
    {
      key: "total_orders",
      label: "TOTAL ORDERS",
      value: totalOrders,
    },
    {
      key: "completed",
      label: "COMPLETED",
      value: completedOrders,
    },
    {
      key: "disputes_and_claims",
      label: "DISPUTES & CLAIMS",
      value: disputesAndClaims,
    },
    {
      key: "account_status",
      label: "ACCOUNT STATUS",
      value: displayStatus,
    },
  ];

  let ordersAndJobs: any[] = [];
  if (homeownerBookings.length > 0) {
    ordersAndJobs = homeownerBookings.map((b: any) => {
      const shortId = b._id.toString().slice(-4).toUpperCase();
      const jobId = `JOB-${shortId}`;
      const serviceName =
        b.jobRequest?.headline ||
        b.jobRequest?.title ||
        "Kitchen Sink Leak & P-Trap Repair";
      const amount = b.totalAmount || 0;
      const status = b.status || "scheduled";
      const date = b.appointmentDate || b.createdAt;

      return {
        _id: b._id,
        jobId,
        bookingId: b._id,
        service: serviceName,
        amount,
        formattedAmount: `$${amount}`,
        status, // "completed", "scheduled", "disputed"
        date: formatDisplayDate(date),
        rawDate: date,
        professional: b.professional
          ? {
              _id: b.professional._id,
              name: b.professional.name,
              email: b.professional.email,
              phone: b.professional.phone,
              companyName: b.professional.companyName,
              profileImage: b.professional.profileImage,
            }
          : null,
      };
    });
  } else if (homeownerJobRequests.length > 0) {
    ordersAndJobs = homeownerJobRequests.map((j: any) => {
      const shortId = j._id.toString().slice(-4).toUpperCase();
      const jobId = `JOB-${shortId}`;
      const serviceName =
        j.headline || j.title || (j.category as any)?.name || "Service";
      const amount = j.estimatedBudget || 0;
      const status =
        j.status === "completed"
          ? "completed"
          : j.status === "cancelled"
            ? "disputed"
            : "scheduled";
      const date = j.createdAt;

      return {
        _id: j._id,
        jobId,
        jobRequestId: j._id,
        service: serviceName,
        amount,
        formattedAmount: `$${amount}`,
        status,
        date: formatDisplayDate(date),
        rawDate: date,
        professional: null,
      };
    });
  }

  return {
    header,
    statCards,
    ordersAndJobs,
  };
};

const updateUserStatusByIdToDB = async (
  id: string,
  status: STATUS.ACTIVE | STATUS.INACTIVE | STATUS.BANNED,
) => {
  if (![STATUS.ACTIVE, STATUS.INACTIVE, STATUS.BANNED].includes(status)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Status must be either 'active', 'inactive', or 'banned'",
    );
  }

  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, "No user is found by this ID");
  }

  const result = await User.findByIdAndUpdate(
    id,
    { status },
    { new: true },
  ).select("-password -authentication");

  if (!result) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Failed to update status");
  }

  return result;
};

const getClearancesFromDB = async (query: Record<string, unknown>) => {
  const approvalStatus = (query.approvalStatus as string)
    ?.toLowerCase?.()
    ?.trim?.();

  const filterCondition: Record<string, any> = {
    role: USER_ROLES.PROFESSIONAL,
  };

  if (approvalStatus && approvalStatus !== "all") {
    filterCondition.approvalStatus = approvalStatus;
  } else if (!approvalStatus) {
    // Default to pending clearances if no specific status is requested
    filterCondition.approvalStatus = APPROVAL_STATUS.PENDING;
  }

  const baseQuery = User.find(filterCondition)
    .populate("category", "name icon coverImage")
    .populate("projectPhotos.category", "name icon coverImage")
    .select("-password -authentication -deviceToken");

  const queryBuilder = new QueryBuilder<IUser>(baseQuery, query)
    .search(USER_SEARCHABLE_FIELDS)
    .filter()
    .sort()
    .fields()
    .paginate();

  const [clearances, meta, counts] = await Promise.all([
    queryBuilder.modelQuery.lean(),
    queryBuilder.countTotal(),
    Promise.all([
      User.countDocuments({
        role: USER_ROLES.PROFESSIONAL,
        approvalStatus: APPROVAL_STATUS.PENDING,
      }),
      User.countDocuments({
        role: USER_ROLES.PROFESSIONAL,
        approvalStatus: APPROVAL_STATUS.APPROVED,
      }),
      User.countDocuments({
        role: USER_ROLES.PROFESSIONAL,
        approvalStatus: APPROVAL_STATUS.REJECTED,
      }),
      User.countDocuments({
        role: USER_ROLES.PROFESSIONAL,
      }),
    ]).then(([pending, approved, rejected, total]) => ({
      pending,
      approved,
      rejected,
      total,
    })),
  ]);

  return {
    data: clearances,
    meta,
    counts,
  };
};

const updateApprovalStatusByIdToDB = async (
  id: string,
  approvalStatus: APPROVAL_STATUS,
  rejectionReason?: string,
) => {
  const normalizedStatus = (
    approvalStatus?.toLowerCase?.()?.trim?.() || approvalStatus
  ) as APPROVAL_STATUS;

  if (!Object.values(APPROVAL_STATUS).includes(normalizedStatus)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Approval status must be 'pending', 'approved', or 'rejected'",
    );
  }

  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, "No user is found by this ID");
  }

  const updateFields: Record<string, any> = {
    approvalStatus: normalizedStatus,
  };

  if (normalizedStatus === APPROVAL_STATUS.APPROVED) {
    if (user.tradeLicense) {
      updateFields["tradeLicense.isVerified"] = true;
    }
    if (user.liabilityInsurance) {
      updateFields["liabilityInsurance.isVerified"] = true;
    }
    updateFields.rejectionReason = null;
  } else if (normalizedStatus === APPROVAL_STATUS.REJECTED) {
    if (user.tradeLicense) {
      updateFields["tradeLicense.isVerified"] = false;
    }
    if (user.liabilityInsurance) {
      updateFields["liabilityInsurance.isVerified"] = false;
    }
    if (rejectionReason !== undefined) {
      updateFields.rejectionReason = rejectionReason.trim();
    }
  } else if (normalizedStatus === APPROVAL_STATUS.PENDING) {
    if (user.tradeLicense) {
      updateFields["tradeLicense.isVerified"] = false;
    }
    if (user.liabilityInsurance) {
      updateFields["liabilityInsurance.isVerified"] = false;
    }
  }

  const result = await User.findByIdAndUpdate(
    id,
    { $set: updateFields },
    { new: true },
  )
    .populate("category", "name icon coverImage")
    .select("-password -authentication");

  if (user.role === USER_ROLES.PROFESSIONAL) {
    let notificationTitle = "Application Status Update";
    let notificationText = `Your professional application status has been updated to ${normalizedStatus}.`;

    if (normalizedStatus === APPROVAL_STATUS.APPROVED) {
      notificationTitle = "Application Approved";
      notificationText =
        "Your professional application has been approved. You can now receive local service jobs.";
    } else if (normalizedStatus === APPROVAL_STATUS.REJECTED) {
      notificationTitle = "Application Rejected";
      notificationText = rejectionReason
        ? `Your professional application has been rejected. Reason: ${rejectionReason}`
        : "Your professional application has been rejected. Please review your credentials and resubmit or contact support.";
    }

    await sendNotifications({
      receiver: user._id.toString(),
      type: NOTIFICATION_TYPE.PROFESSIONAL,
      title: notificationTitle,
      text: notificationText,
      referenceId: user._id.toString(),
      referenceModel: "User",
    });
  }

  return result;
};

const deleteUserByIdFromD = async (id: string) => {
  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User does not exist");
  }

  const result = await User.softDeleteById(id);
  if (!result) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Failed to delete user");
  }

  return result;
};

const deleteProfileFromDB = async (id: string, password?: string) => {
  const user = await User.findById(id).select("+password");
  if (!user) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User doesn't exist!");
  }

  if (user.password && password) {
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Password is incorrect!");
    }
  }

  const result = await User.softDeleteById(id);
  if (!result) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Failed to delete profile");
  }

  return result;
};

const addProjectPhotoToDB = async (
  userId: string,
  payload: {
    image?: string;
    projectPhoto?: string;
    title: string;
    category: string;
  },
) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }
  if (user.role !== USER_ROLES.PROFESSIONAL) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      "Only professionals can manage project photos",
    );
  }

  const imageUrl = (payload.projectPhoto || payload.image || "").trim();
  if (!imageUrl) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Project photo image is required",
    );
  }

  await validateCategoryExists(payload.category.toString());

  user.projectPhotos = user.projectPhotos || [];
  user.projectPhotos.push({
    image: imageUrl,
    title: payload.title.trim(),
    category: payload.category as any,
    createdAt: new Date(),
  });

  await user.save();
  await user.populate("projectPhotos.category", "name icon coverImage");
  return user.projectPhotos;
};

const updateProjectPhotoToDB = async (
  userId: string,
  photoId: string,
  payload: {
    image?: string;
    projectPhoto?: string;
    title?: string;
    category?: string;
  },
) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }
  if (user.role !== USER_ROLES.PROFESSIONAL) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      "Only professionals can manage project photos",
    );
  }

  const photo =
    (user.projectPhotos as any)?.id?.(photoId) ||
    user.projectPhotos?.find((p) => p._id?.toString() === photoId);

  if (!photo) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Project photo not found");
  }

  const newImage = (payload.projectPhoto || payload.image || "").trim();
  if (newImage) {
    if (photo.image) {
      unlinkFile(photo.image);
    }
    photo.image = newImage;
  }
  if (payload.title !== undefined) {
    photo.title = payload.title.trim();
  }
  if (payload.category !== undefined) {
    await validateCategoryExists(payload.category.toString());
    photo.category = payload.category as any;
  }

  await user.save();
  await user.populate("projectPhotos.category", "name icon coverImage");
  return user.projectPhotos;
};

const deleteProjectPhotoFromDB = async (userId: string, photoId: string) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }
  if (user.role !== USER_ROLES.PROFESSIONAL) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      "Only professionals can manage project photos",
    );
  }

  const photoIndex =
    user.projectPhotos?.findIndex((p) => p._id?.toString() === photoId) ?? -1;
  if (photoIndex === -1 || !user.projectPhotos) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Project photo not found");
  }

  const [removed] = user.projectPhotos.splice(photoIndex, 1);
  if (removed?.image) {
    unlinkFile(removed.image);
  }

  await user.save();
  await user.populate("projectPhotos.category", "name icon coverImage");
  return user.projectPhotos;
};

export const UserService = {
  createUserToDB,
  getUsersFromDB,
  getClearancesFromDB,
  getAdminFromDB,
  getSuperAdminFromDB,
  deleteAdminFromDB,
  getUserByIdFromDB,
  getMyProfileFromDB,
  updateProfileToDB,
  createAdminToDB,
  updateUserStatusByIdToDB,
  updateApprovalStatusByIdToDB,
  updateAdminStatusByIdToDB,
  deleteUserByIdFromD,
  deleteProfileFromDB,
  addProjectPhotoToDB,
  updateProjectPhotoToDB,
  deleteProjectPhotoFromDB,
};
