import mongoose, { PipelineStage } from "mongoose";
import { StatusCodes } from "http-status-codes";
import {
  APPROVAL_STATUS,
  CHECKR_VERIFICATION_STATUS,
  STATUS,
  USER_ROLES,
} from "../../../enums/user";
import { JOB_REQUEST_STATUS } from "../../../enums/jobRequest";
import ApiError from "../../../errors/ApiErrors";
import { escapeRegex } from "../../../helpers/searchHelper";
import { Category } from "../category/category.model";
import { Review } from "../review/review.model";
import { User } from "../user/user.model";
import { Service } from "../service/service.model";
import { JobRequest } from "../jobRequest/jobRequest.model";
import { Booking } from "../booking/booking.model";
import { BOOKING_STATUS } from "../booking/booking.constant";
import { FavoriteService } from "../favorite/favorite.service";
import {
  getBatchGoogleDistances,
  TDistanceResult,
} from "../../../helpers/googleMapsHelper";
import {
  TAnalyticsPeriod,
  TClientAndWorkVolumeItem,
  TDailyIncomeItem,
  THistoryItem,
  TMonthlyIncomeItem,
  TProfessionalAnalyticsResponse,
  TProfessionalApplicationResponse,
  TProfessionalHistoryResponse,
} from "./professional.interface";

const assertValidObjectId = (id: string, label = "professional") => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, `Invalid ${label} ID`);
  }
};

const parseBudgetFilter = (
  query: Record<string, unknown>,
): { minBudget?: number; maxBudget?: number } => {
  let minBudget: number | undefined;
  let maxBudget: number | undefined;

  const rawMin = query.minBudget ?? query.minPrice;
  if (rawMin !== undefined && rawMin !== null && rawMin !== "") {
    const parsed = Number(rawMin);
    if (!isNaN(parsed)) minBudget = parsed;
  }

  const rawMax = query.maxBudget ?? query.maxPrice;
  if (rawMax !== undefined && rawMax !== null && rawMax !== "") {
    const parsed = Number(rawMax);
    if (!isNaN(parsed)) maxBudget = parsed;
  }

  const rawBudget = query.budget as string | undefined;
  if (rawBudget && typeof rawBudget === "string") {
    const normalized = rawBudget.trim().toLowerCase();
    if (
      normalized === "under-85" ||
      normalized === "under_85" ||
      normalized === "under 85" ||
      normalized === "value" ||
      normalized === "<85" ||
      normalized === "<=85"
    ) {
      maxBudget = 85;
    } else if (
      normalized === "85-130" ||
      normalized === "85_130" ||
      normalized === "85 - 130" ||
      normalized === "mid-range" ||
      normalized === "mid_range"
    ) {
      minBudget = 85;
      maxBudget = 130;
    } else if (
      normalized === "above-130" ||
      normalized === "above_130" ||
      normalized === "above 130" ||
      normalized === "130-above" ||
      normalized === "130 & above" ||
      normalized === "high-end" ||
      normalized === "high_end" ||
      normalized === ">130" ||
      normalized === ">=130"
    ) {
      minBudget = 130;
    } else if (normalized.includes("-")) {
      const parts = normalized.split("-").map((p) => Number(p.trim()));
      if (!isNaN(parts[0])) minBudget = parts[0];
      if (parts[1] && !isNaN(parts[1])) maxBudget = parts[1];
    }
  }

  return { minBudget, maxBudget };
};

const computeTodayHours = (businessHours?: any) => {
  if (!businessHours) {
    return { isOpenToday: true, todayHours: "8:00 AM - 6:00 PM" };
  }

  const daysOfWeek = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const todayName = daysOfWeek[new Date().getDay()];

  if (businessHours.mode === "customize" && businessHours.days) {
    const todayConfig = businessHours.days[todayName];
    if (todayConfig) {
      const isOpen = todayConfig.isOpen !== false;
      return {
        isOpenToday: isOpen,
        todayHours: isOpen
          ? `${todayConfig.openTime || "8:00 AM"} - ${todayConfig.closeTime || "6:00 PM"}`
          : "Closed",
      };
    }
  }

  const allDays = businessHours.allDays;
  const isOpen = allDays?.isOpen !== false;
  return {
    isOpenToday: isOpen,
    todayHours: isOpen
      ? `${allDays?.openTime || "8:00 AM"} - ${allDays?.closeTime || "6:00 PM"}`
      : "Closed",
  };
};

type TPopulatedCategory = {
  _id: mongoose.Types.ObjectId;
  name: string;
  icon?: string;
  coverImage?: string;
};

const buildCategoryTabs = (items: Array<{ category?: unknown }>) => {
  const categoryMap = new Map<string, TPopulatedCategory & { count: number }>();

  for (const item of items) {
    const cat = item.category as TPopulatedCategory | null | undefined;
    if (!cat || typeof cat !== "object" || !cat._id) {
      continue;
    }

    const key = cat._id.toString();
    const existing = categoryMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      categoryMap.set(key, {
        _id: cat._id,
        name: cat.name,
        icon: cat.icon,
        coverImage: cat.coverImage,
        count: 1,
      });
    }
  }

  return Array.from(categoryMap.values());
};

const getAllProfessionalsFromDB = async (
  query: Record<string, unknown> = {},
  currentUserId?: string,
) => {
  const rawCategoryId = (query.category || query.categoryId) as
    | string
    | undefined;
  const categoryParam = rawCategoryId?.trim();

  let targetCategoryId: mongoose.Types.ObjectId | null = null;
  if (
    categoryParam &&
    categoryParam.toLowerCase() !== "all" &&
    categoryParam.toLowerCase() !== "all services"
  ) {
    if (mongoose.Types.ObjectId.isValid(categoryParam)) {
      targetCategoryId = new mongoose.Types.ObjectId(categoryParam);
    } else {
      const matchedCategory = await Category.findOne({
        name: new RegExp(`^${escapeRegex(categoryParam)}$`, "i"),
        isDeleted: { $ne: true },
      }).lean();
      if (matchedCategory) {
        targetCategoryId = matchedCategory._id as mongoose.Types.ObjectId;
      }
    }
  }

  const searchTerm = (
    (query.searchTerm || query.search) as string | undefined
  )?.trim();
  const locationQuery = (
    (query.location || query.city || query.state || query.zipCode) as
      | string
      | undefined
  )?.trim();

  let userLat: number | undefined;
  let userLng: number | undefined;

  const rawLat = query.latitude ?? query.lat;
  const rawLng = query.longitude ?? query.lng;
  if (rawLat !== undefined && rawLat !== null && rawLat !== "") {
    const parsed = Number(rawLat);
    if (!isNaN(parsed)) userLat = parsed;
  }
  if (rawLng !== undefined && rawLng !== null && rawLng !== "") {
    const parsed = Number(rawLng);
    if (!isNaN(parsed)) userLng = parsed;
  }

  // If coordinates are not provided in query, retrieve from logged-in user's profile
  if ((userLat === undefined || userLng === undefined) && currentUserId) {
    const currentUser = await User.findById(currentUserId)
      .select("location")
      .lean();
    const userCoords = currentUser?.location?.coordinates;
    if (
      Array.isArray(userCoords) &&
      userCoords.length === 2 &&
      (userCoords[0] !== 0 || userCoords[1] !== 0)
    ) {
      userLng = userCoords[0];
      userLat = userCoords[1];
    }
  }

  const hasUserCoords =
    userLat !== undefined &&
    userLng !== undefined &&
    !isNaN(userLat) &&
    !isNaN(userLng);

  const radiusParam = query.radius ?? query.maxDistance;
  const maxDistanceInMiles =
    radiusParam !== undefined && radiusParam !== null && radiusParam !== ""
      ? Number(radiusParam)
      : undefined;

  const { minBudget, maxBudget } = parseBudgetFilter(query);

  const rawRating = query.minRating ?? query.rating;
  const minRating =
    rawRating !== undefined && rawRating !== null && rawRating !== ""
      ? Number(rawRating)
      : undefined;

  const sortBy = ((query.sortBy || query.sort) as string | undefined)
    ?.toLowerCase()
    .trim();

  // 1. Initial Match Stage for User
  const initialMatch: Record<string, unknown> = {
    role: USER_ROLES.PROFESSIONAL,
    status: STATUS.ACTIVE,
    approvalStatus: APPROVAL_STATUS.APPROVED,
    isDeleted: { $ne: true },
  };

  if (locationQuery) {
    const locRegex = new RegExp(escapeRegex(locationQuery), "i");
    initialMatch.$or = [
      { city: locRegex },
      { state: locRegex },
      { zipCode: locRegex },
      { streetAddress: locRegex },
      { "location.address": locRegex },
    ];
  }

  const pipeline: PipelineStage[] = [
    { $match: initialMatch },
    // Lookup primary category from Category collection
    {
      $lookup: {
        from: "categories",
        localField: "category",
        foreignField: "_id",
        as: "primaryCategory",
      },
    },
    {
      $unwind: {
        path: "$primaryCategory",
        preserveNullAndEmptyArrays: true,
      },
    },
    // Lookup professional's services
    {
      $lookup: {
        from: "services",
        let: { proId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$professional", "$$proId"] },
              isDeleted: { $ne: true },
            },
          },
          {
            $lookup: {
              from: "categories",
              localField: "category",
              foreignField: "_id",
              as: "categoryObj",
            },
          },
          {
            $unwind: {
              path: "$categoryObj",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $project: {
              _id: 1,
              name: 1,
              description: 1,
              category: {
                $ifNull: ["$categoryObj", "$category"],
              },
            },
          },
        ],
        as: "services",
      },
    },
    // Lookup review ratings
    {
      $lookup: {
        from: "reviews",
        let: { proId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $or: [
                  { $eq: ["$professional", "$$proId"] },
                  { $eq: ["$contractor", "$$proId"] },
                ],
              },
            },
          },
          {
            $group: {
              _id: null,
              totalReviews: { $sum: 1 },
              averageRating: { $avg: "$rating" },
            },
          },
        ],
        as: "reviewStats",
      },
    },
    // Lookup completed jobs from jobrequests
    {
      $lookup: {
        from: "jobrequests",
        let: { proId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$professional", "$$proId"] },
              status: JOB_REQUEST_STATUS.COMPLETED,
              isDeleted: { $ne: true },
            },
          },
          {
            $count: "count",
          },
        ],
        as: "jobStats",
      },
    },
    // Lookup completed bookings
    {
      $lookup: {
        from: "bookings",
        let: { proId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$professional", "$$proId"] },
              status: BOOKING_STATUS.COMPLETED,
              isDeleted: { $ne: true },
            },
          },
          {
            $count: "count",
          },
        ],
        as: "bookingStats",
      },
    },
    // Add computed fields
    {
      $addFields: {
        averageRating: {
          $round: [
            {
              $ifNull: [{ $arrayElemAt: ["$reviewStats.averageRating", 0] }, 0],
            },
            1,
          ],
        },
        totalReviews: {
          $ifNull: [{ $arrayElemAt: ["$reviewStats.totalReviews", 0] }, 0],
        },
        effectiveRate: {
          $ifNull: ["$startingRate", { $ifNull: ["$hourlyRate", null] }],
        },
        actualCompletedJobs: {
          $add: [
            { $ifNull: [{ $arrayElemAt: ["$jobStats.count", 0] }, 0] },
            { $ifNull: [{ $arrayElemAt: ["$bookingStats.count", 0] }, 0] },
          ],
        },
      },
    },
  ];

  // Category filter
  if (targetCategoryId) {
    pipeline.push({
      $match: {
        $or: [
          { "primaryCategory._id": targetCategoryId },
          { "services.category._id": targetCategoryId },
          { "services.category": targetCategoryId },
          { "projectPhotos.category": targetCategoryId },
        ],
      },
    });
  }

  // Search filter
  if (searchTerm) {
    const sRegex = new RegExp(escapeRegex(searchTerm), "i");
    pipeline.push({
      $match: {
        $or: [
          { name: sRegex },
          { companyName: sRegex },
          { about: sRegex },
          { "primaryCategory.name": sRegex },
          { "services.name": sRegex },
          { "services.description": sRegex },
        ],
      },
    });
  }

  // Budget filter
  const budgetMatch: Record<string, unknown> = {};
  if (minBudget !== undefined && !isNaN(minBudget)) {
    budgetMatch.$gte = minBudget;
  }
  if (maxBudget !== undefined && !isNaN(maxBudget)) {
    budgetMatch.$lte = maxBudget;
  }
  if (Object.keys(budgetMatch).length > 0) {
    pipeline.push({
      $match: { effectiveRate: budgetMatch },
    });
  }

  // Min rating filter
  if (minRating !== undefined && !isNaN(minRating)) {
    pipeline.push({
      $match: { averageRating: { $gte: minRating } },
    });
  }

  // Project fields
  pipeline.push({
    $project: {
      _id: 1,
      name: 1,
      companyName: 1,
      profileImage: 1,
      verified: 1,
      isBackgroundVerified: { $ifNull: ["$backgroundCheck.passed", false] },
      isLicenseVerified: { $ifNull: ["$tradeLicense.isVerified", false] },
      isInsuranceVerified: {
        $ifNull: ["$liabilityInsurance.isVerified", false],
      },
      city: 1,
      state: 1,
      zipCode: 1,
      streetAddress: 1,
      location: 1,
      about: 1,
      yearsOfExperience: { $ifNull: ["$yearsOfExperience", ""] },
      serviceRadiusInMiles: 1,
      businessHours: 1,
      acceptedPayments: 1,
      projectPhotos: 1,
      startingRate: "$effectiveRate",
      startingEstimate: "$effectiveRate",
      startingPrice: "$effectiveRate",
      hourlyRate: {
        $ifNull: ["$hourlyRate", { $ifNull: ["$effectiveRate", null] }],
      },
      completedJobs: {
        $cond: {
          if: { $gt: ["$completedJobs", 0] },
          then: "$completedJobs",
          else: { $ifNull: ["$actualCompletedJobs", 0] },
        },
      },
      localJobs: { $ifNull: ["$localJobs", 0] },
      responseTime: { $ifNull: ["$responseTime", ""] },
      availability: { $ifNull: ["$availability", ""] },
      averageRating: 1,
      totalReviews: 1,
      category: "$primaryCategory",
      serviceCount: { $size: "$services" },
      services: 1,
      createdAt: 1,
    },
  });

  // Sort stage
  let sortStage: Record<string, 1 | -1> = {
    averageRating: -1,
    totalReviews: -1,
    completedJobs: -1,
    createdAt: -1,
  };
  if (
    sortBy === "highest_rated" ||
    sortBy === "rating" ||
    sortBy === "-rating" ||
    sortBy === "top_rated" ||
    sortBy === "top-rated"
  ) {
    sortStage = {
      averageRating: -1,
      totalReviews: -1,
      completedJobs: -1,
      createdAt: -1,
    };
  } else if (
    sortBy === "most_reviewed" ||
    sortBy === "reviews" ||
    sortBy === "-reviews"
  ) {
    sortStage = { totalReviews: -1, averageRating: -1, createdAt: -1 };
  } else if (
    sortBy === "price_low_to_high" ||
    sortBy === "price_asc" ||
    sortBy === "budget_asc" ||
    sortBy === "low_to_high"
  ) {
    sortStage = { startingRate: 1, averageRating: -1, createdAt: -1 };
  } else if (
    sortBy === "price_high_to_low" ||
    sortBy === "price_desc" ||
    sortBy === "budget_desc" ||
    sortBy === "high_to_low"
  ) {
    sortStage = { startingRate: -1, averageRating: -1, createdAt: -1 };
  } else if (sortBy === "newest" || sortBy === "created_at") {
    sortStage = { createdAt: -1, _id: 1 };
  }

  pipeline.push({ $sort: sortStage });

  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.max(1, Number(query.limit) || 10);
  const skip = (page - 1) * limit;

  pipeline.push({
    $facet: {
      data: [{ $skip: skip }, { $limit: limit }],
      totalCount: [{ $count: "total" }],
    },
  });

  const [aggregateResult] = await User.aggregate(pipeline);
  const rawData = aggregateResult?.data || [];
  const total = aggregateResult?.totalCount?.[0]?.total || 0;
  const totalPage = Math.ceil(total / limit);

  // Compute favorite status
  const professionalIds = rawData.map((item: any) => item._id);
  const favoriteSet = currentUserId
    ? await FavoriteService.getFavoriteProfessionalIds(
        currentUserId,
        professionalIds,
      )
    : new Set<string>();

  // Calculate Google Maps Distance Matrix
  let distanceMap = new Map<string, TDistanceResult>();
  if (hasUserCoords) {
    const destinations = rawData
      .filter((item: any) => {
        const coords = item.location?.coordinates;
        return (
          Array.isArray(coords) &&
          coords.length === 2 &&
          (coords[0] !== 0 || coords[1] !== 0)
        );
      })
      .map((item: any) => ({
        id: item._id.toString(),
        lat: item.location.coordinates[1],
        lng: item.location.coordinates[0],
      }));

    if (destinations.length > 0) {
      distanceMap = await getBatchGoogleDistances(
        { lat: userLat!, lng: userLng! },
        destinations,
      );
    }
  }

  // Enrich data for UI cards
  let enrichedData = rawData.map((item: any) => {
    let distanceInMiles: number | null = null;
    let distanceFormatted: string | null = null;
    let durationFormatted: string | null = null;

    if (hasUserCoords) {
      const distInfo = distanceMap.get(item._id.toString());
      if (distInfo) {
        distanceInMiles = distInfo.distanceInMiles;
        distanceFormatted = distInfo.distanceFormatted;
        durationFormatted = distInfo.durationText || null;
      }
    }

    const coverImage =
      item.profileImage ||
      item.projectPhotos?.[0]?.image ||
      item.category?.coverImage ||
      "";

    const locationFormatted = `${item.city || ""}${
      item.city && item.state ? ", " : ""
    }${item.state || ""}`;

    return {
      ...item,
      coverImage,
      thumbnail: coverImage,
      locationFormatted,
      distanceInMiles,
      distanceFormatted,
      durationFormatted,
      hiredCount: item.completedJobs,
      totalJobs: item.completedJobs,
      isFavorite: favoriteSet.has(item._id.toString()),
    };
  });

  // Filter by distance radius if specified
  if (
    hasUserCoords &&
    maxDistanceInMiles !== undefined &&
    !isNaN(maxDistanceInMiles)
  ) {
    enrichedData = enrichedData.filter(
      (item: any) =>
        item.distanceInMiles !== null &&
        item.distanceInMiles <= maxDistanceInMiles,
    );
  }

  // If sort was distance
  if (sortBy === "distance" || sortBy === "nearest") {
    enrichedData.sort((a: any, b: any) => {
      const distA = a.distanceInMiles ?? Number.MAX_SAFE_INTEGER;
      const distB = b.distanceInMiles ?? Number.MAX_SAFE_INTEGER;
      return distA - distB;
    });
  }

  return {
    data: enrichedData,
    meta: {
      page,
      limit,
      total,
      totalPage,
    },
  };
};

const getProfessionalDetailsFromDB = async (
  professionalId: string,
  currentUserId?: string,
) => {
  assertValidObjectId(professionalId, "professional");

  const professional = await User.findOne({
    _id: professionalId,
    role: USER_ROLES.PROFESSIONAL,
    status: STATUS.ACTIVE,
    approvalStatus: APPROVAL_STATUS.APPROVED,
  })
    .select(
      "name companyName profileImage verified category about yearsOfExperience serviceRadiusInMiles city state zipCode streetAddress location timezone businessHours acceptedPayments projectPhotos backgroundCheck.passed tradeLicense.isVerified liabilityInsurance.isVerified startingRate hourlyRate completedJobs localJobs responseTime availability createdAt",
    )
    .populate("category", "name icon coverImage")
    .populate("projectPhotos.category", "name icon coverImage")
    .lean();

  if (!professional) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Professional not found");
  }

  const [
    services,
    reviewSummary,
    reviews,
    isFavorite,
    completedJobRequestsCount,
    completedBookingsCount,
  ] = await Promise.all([
    Service.find({ professional: professionalId, isDeleted: { $ne: true } })
      .populate("category", "name icon coverImage")
      .sort({ createdAt: -1 })
      .lean(),
    Review.calculateAverageRating(professionalId),
    Review.find({
      $or: [
        { contractor: professionalId },
        { professional: professionalId },
      ],
    })
      .populate({
        path: "homeowner",
        select: "name profileImage city state",
      })
      .populate({
        path: "tenant",
        select: "name profileImage city state",
      })
      .populate({
        path: "professional",
        select: "name companyName profileImage",
      })
      .populate({
        path: "contractor",
        select: "name companyName profileImage",
      })
      .sort({ createdAt: -1 })
      .lean(),
    currentUserId
      ? FavoriteService.isFavorite(currentUserId, professionalId)
      : Promise.resolve(false),
    JobRequest.countDocuments({
      professional: professionalId,
      status: JOB_REQUEST_STATUS.COMPLETED,
      isDeleted: { $ne: true },
    }),
    Booking.countDocuments({
      professional: professionalId,
      status: BOOKING_STATUS.COMPLETED,
      isDeleted: { $ne: true },
    }),
  ]);

  const formattedReviews = (reviews || []).map((r: any) => {
    const client = r.homeowner || r.tenant;
    const pro = r.professional || r.contractor;
    delete r.tenant;
    delete r.contractor;
    delete r.maintenance;
    return {
      ...r,
      homeowner: client,
      professional: pro,
      isReplied: Boolean(
        r.isReplied || (r.reply && r.reply.trim().length > 0),
      ),
      reply: r.reply || null,
      repliedAt: r.repliedAt || null,
    };
  });

  const projectPhotos = professional.projectPhotos || [];
  const hoursInfo = computeTodayHours(professional.businessHours);
  const startingRate =
    professional.startingRate ?? professional.hourlyRate ?? null;
  const actualCompletedJobsCount =
    completedJobRequestsCount + completedBookingsCount;
  const completedJobs =
    professional.completedJobs ||
    (actualCompletedJobsCount > 0 ? actualCompletedJobsCount : 0);
  const localJobs = professional.localJobs || 0;
  const coverImage =
    professional.profileImage ||
    projectPhotos[0]?.image ||
    (professional.category as any)?.coverImage ||
    "";
  const locationFormatted = [professional.city, professional.state]
    .filter(Boolean)
    .join(", ");

  // Calculate distance between current user and this professional via Google Maps
  let distanceInMiles: number | null = null;
  let distanceFormatted: string | null = null;
  let durationFormatted: string | null = null;

  if (currentUserId && professional.location?.coordinates) {
    const currentUser = await User.findById(currentUserId)
      .select("location")
      .lean();
    const userCoords = currentUser?.location?.coordinates;
    const proCoords = professional.location.coordinates;
    if (
      Array.isArray(userCoords) &&
      userCoords.length === 2 &&
      (userCoords[0] !== 0 || userCoords[1] !== 0) &&
      Array.isArray(proCoords) &&
      proCoords.length === 2 &&
      (proCoords[0] !== 0 || proCoords[1] !== 0)
    ) {
      const distMap = await getBatchGoogleDistances(
        { lat: userCoords[1], lng: userCoords[0] },
        [
          {
            id: professional._id.toString(),
            lat: proCoords[1],
            lng: proCoords[0],
          },
        ],
      );
      const distInfo = distMap.get(professional._id.toString());
      if (distInfo) {
        distanceInMiles = distInfo.distanceInMiles;
        distanceFormatted = distInfo.distanceFormatted;
        durationFormatted = distInfo.durationText || null;
      }
    }
  }

  return {
    _id: professional._id,
    name: professional.name,
    companyName: professional.companyName,
    profileImage: professional.profileImage,
    coverImage,
    thumbnail: coverImage,
    verified: professional.verified,
    isBackgroundVerified: Boolean(professional.backgroundCheck?.passed),
    isLicenseVerified: Boolean(professional.tradeLicense?.isVerified),
    isInsuranceVerified: Boolean(professional.liabilityInsurance?.isVerified),
    category: professional.category || null,
    about: professional.about || "",
    yearsOfExperience: professional.yearsOfExperience || "",
    serviceRadiusInMiles: professional.serviceRadiusInMiles ?? null,
    city: professional.city || "",
    state: professional.state || "",
    zipCode: professional.zipCode || "",
    streetAddress: professional.streetAddress || "",
    location: professional.location || null,
    locationFormatted,
    distanceInMiles,
    distanceFormatted,
    durationFormatted,
    timezone: professional.timezone || "",
    businessHours: professional.businessHours || null,
    isOpenToday: hoursInfo.isOpenToday,
    todayHours: hoursInfo.todayHours,
    acceptedPayments: professional.acceptedPayments || [],
    startingRate,
    startingEstimate: startingRate,
    startingPrice: startingRate,
    hourlyRate: professional.hourlyRate ?? startingRate,
    completedJobs,
    hiredCount: completedJobs,
    localJobs,
    responseTime: professional.responseTime || "",
    availability: professional.availability || "",
    averageRating: reviewSummary.averageRating,
    totalReviews: reviewSummary.totalReviews,
    recommendationRate: reviewSummary.recommendationRate || 100,
    recommendationPercentage: reviewSummary.recommendationPercentage || 100,
    ratingDistribution: reviewSummary.ratingDistribution,
    ratingBreakdown: reviewSummary.ratingBreakdown,
    serviceCount: services.length,
    services,
    photoCount: projectPhotos.length,
    categories: buildCategoryTabs([...services, ...projectPhotos]),
    projectPhotos,
    reviews: formattedReviews,
    isFavorite,
    createdAt: professional.createdAt,
  };
};

const getTopRatedProfessionalsFromDB = async (
  query: Record<string, unknown> = {},
  currentUserId?: string,
) => {
  const limitParam = query.limit;
  let parsedLimit = 8;
  if (limitParam !== undefined && limitParam !== null && limitParam !== "") {
    const num = Number(limitParam);
    if (!isNaN(num) && num > 0) {
      parsedLimit = num;
    }
  }

  const topRatedQuery: Record<string, unknown> = {
    ...query,
    limit: parsedLimit,
    sortBy: "highest_rated",
  };

  return getAllProfessionalsFromDB(topRatedQuery, currentUserId);
};

const ANALYTICS_MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const normalizeAnalyticsPeriod = (
  period?: unknown,
): TAnalyticsPeriod => {
  if (typeof period !== "string") return "this_year";
  const cleaned = period.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (
    cleaned === "this_month" ||
    cleaned === "thismonth" ||
    cleaned === "month" ||
    cleaned === "current_month"
  ) {
    return "this_month";
  }
  if (
    cleaned === "all_time" ||
    cleaned === "alltime" ||
    cleaned === "all" ||
    cleaned === "lifetime"
  ) {
    return "all_time";
  }
  return "this_year";
};

const formatAnalyticsHistoryDate = (
  date: Date | string | null | undefined,
): string => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return `${ANALYTICS_MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

const getBookingEffectiveDate = (booking: any): Date => {
  const rawDate =
    booking.paidAt ||
    booking.homeownerCompletedAt ||
    booking.contractorCompletedAt ||
    booking.appointmentDate ||
    booking.createdAt;
  const d = new Date(rawDate);
  return isNaN(d.getTime()) ? new Date() : d;
};

const getProfessionalAnalyticsFromDB = async (
  professionalId: string,
  query: Record<string, unknown> = {},
): Promise<TProfessionalAnalyticsResponse> => {
  assertValidObjectId(professionalId, "professional");
  const professionalObjectId = new mongoose.Types.ObjectId(professionalId);

  // Verify professional exists
  const professional = await User.findById(professionalObjectId).lean();
  if (!professional) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Professional not found");
  }

  const period = normalizeAnalyticsPeriod(query.period);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0 to 11

  const parsedYear = Number(query.year);
  const selectedYear =
    !isNaN(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100
      ? parsedYear
      : currentYear;

  const parsedMonth = Number(query.month);
  const selectedMonth =
    !isNaN(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12
      ? parsedMonth - 1
      : currentMonth;

  // Determine period date ranges
  let startDate: Date;
  let endDate: Date;
  let prevStartDate: Date | null = null;
  let prevEndDate: Date | null = null;

  if (period === "this_month") {
    startDate = new Date(selectedYear, selectedMonth, 1, 0, 0, 0, 0);
    endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);

    prevStartDate = new Date(selectedYear, selectedMonth - 1, 1, 0, 0, 0, 0);
    prevEndDate = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999);
  } else if (period === "this_year") {
    startDate = new Date(selectedYear, 0, 1, 0, 0, 0, 0);
    endDate = new Date(selectedYear, 11, 31, 23, 59, 59, 999);

    prevStartDate = new Date(selectedYear - 1, 0, 1, 0, 0, 0, 0);
    prevEndDate = new Date(selectedYear - 1, 11, 31, 23, 59, 59, 999);
  } else {
    // all_time
    startDate = new Date(0);
    endDate = new Date(selectedYear + 10, 11, 31, 23, 59, 59, 999);
    prevStartDate = null;
    prevEndDate = null;
  }

  // Find all completed or settled bookings for this professional
  const completedFilter: Record<string, any> = {
    professional: professionalObjectId,
    isDeleted: { $ne: true },
    status: { $ne: BOOKING_STATUS.CANCELLED },
    $or: [
      { status: BOOKING_STATUS.COMPLETED },
      { paymentStatus: "paid" },
      { homeownerCompletedAt: { $ne: null } },
      { contractorCompletedAt: { $ne: null } },
    ],
  };

  const [allCompletedBookings, overallReviewSummary, periodReviewStats] =
    await Promise.all([
      Booking.find(completedFilter)
        .populate({
          path: "jobRequest",
          select: "headline title description category serviceLocation",
          populate: { path: "category", select: "name icon" },
        })
        .populate("homeowner", "name email profileImage phone")
        .lean(),
      Review.calculateAverageRating(professionalObjectId),
      Review.aggregate([
        {
          $match: {
            $or: [
              { professional: professionalObjectId },
              { contractor: professionalObjectId },
            ],
            ...(period !== "all_time"
              ? { createdAt: { $gte: startDate, $lte: endDate } }
              : {}),
          },
        },
        {
          $group: {
            _id: null,
            totalReviews: { $sum: 1 },
            averageRating: { $avg: "$rating" },
          },
        },
      ]),
    ]);

  // Current period bookings
  const currentPeriodBookings = allCompletedBookings.filter((b) => {
    const d = getBookingEffectiveDate(b);
    return d >= startDate && d <= endDate;
  });

  const currentPeriodEarnings = currentPeriodBookings.reduce(
    (sum, b) => sum + (Number(b.totalAmount) || 0),
    0,
  );

  // Previous period earnings (for growth comparison)
  let prevPeriodEarnings = 0;
  if (prevStartDate && prevEndDate) {
    const prevPeriodBookings = allCompletedBookings.filter((b) => {
      const d = getBookingEffectiveDate(b);
      return d >= prevStartDate! && d <= prevEndDate!;
    });
    prevPeriodEarnings = prevPeriodBookings.reduce(
      (sum, b) => sum + (Number(b.totalAmount) || 0),
      0,
    );
  }

  // Earnings growth calculation
  let earningsGrowth = 0;
  let earningsGrowthFormatted = "+0.0%";
  if (prevPeriodEarnings > 0) {
    earningsGrowth =
      Math.round(
        ((currentPeriodEarnings - prevPeriodEarnings) / prevPeriodEarnings) *
          100 *
          10,
      ) / 10;
    earningsGrowthFormatted =
      earningsGrowth >= 0 ? `+${earningsGrowth}%` : `${earningsGrowth}%`;
  } else if (currentPeriodEarnings > 0) {
    earningsGrowth = 100;
    earningsGrowthFormatted = "+100%";
  } else {
    earningsGrowth = 0;
    earningsGrowthFormatted = "0%";
  }

  // Current period unique clients
  const currentPeriodClientIds = new Set<string>();
  for (const b of currentPeriodBookings) {
    const hId =
      (b.homeowner as any)?._id?.toString() ||
      (b.homeowner as any)?.toString();
    if (hId) currentPeriodClientIds.add(hId);
  }

  // Rating & review computation
  const overallRating = overallReviewSummary?.averageRating || 0;
  const overallTotalReviews = overallReviewSummary?.totalReviews || 0;

  const periodAvgRating =
    periodReviewStats.length > 0 && periodReviewStats[0].averageRating != null
      ? Math.round(periodReviewStats[0].averageRating * 10) / 10
      : 0;
  const periodTotalReviews =
    periodReviewStats.length > 0 && periodReviewStats[0].totalReviews != null
      ? periodReviewStats[0].totalReviews
      : 0;

  const displayRating =
    periodTotalReviews > 0 ? periodAvgRating : overallRating;
  const displayReviews =
    period === "all_time"
      ? overallTotalReviews
      : periodTotalReviews > 0
        ? periodTotalReviews
        : overallTotalReviews;

  // Monthly income overview & Clients & Work Volume (12 months)
  const monthlyIncomeOverview: TMonthlyIncomeItem[] = [];
  const clientsAndWorkVolume: TClientAndWorkVolumeItem[] = [];

  for (let m = 0; m < 12; m++) {
    let matchedMonthBookings: any[] = [];

    if (period === "this_month") {
      // For this_month, highlight the selected month
      if (m === selectedMonth) {
        matchedMonthBookings = allCompletedBookings.filter((b) => {
          const d = getBookingEffectiveDate(b);
          return (
            d.getFullYear() === selectedYear && d.getMonth() === selectedMonth
          );
        });
      } else {
        matchedMonthBookings = [];
      }
    } else if (period === "this_year") {
      matchedMonthBookings = allCompletedBookings.filter((b) => {
        const d = getBookingEffectiveDate(b);
        return d.getFullYear() === selectedYear && d.getMonth() === m;
      });
    } else {
      // all_time: cumulative across all time for this calendar month
      matchedMonthBookings = allCompletedBookings.filter((b) => {
        const d = getBookingEffectiveDate(b);
        return d.getMonth() === m;
      });
    }

    const monthIncome = matchedMonthBookings.reduce(
      (sum, b) => sum + (Number(b.totalAmount) || 0),
      0,
    );
    const roundedIncome = Math.round(monthIncome * 100) / 100;

    const monthClients = new Set<string>();
    for (const b of matchedMonthBookings) {
      const hId =
        (b.homeowner as any)?._id?.toString() ||
        (b.homeowner as any)?.toString();
      if (hId) monthClients.add(hId);
    }

    const jobsCount = matchedMonthBookings.length;
    const clientsCount = monthClients.size;

    monthlyIncomeOverview.push({
      month: ANALYTICS_MONTH_NAMES[m],
      monthNumber: m + 1,
      year: selectedYear,
      income: roundedIncome,
      formattedIncome: `$${roundedIncome.toLocaleString("en-US")}`,
      isSelected: period === "this_month" && m === selectedMonth,
    });

    clientsAndWorkVolume.push({
      month: ANALYTICS_MONTH_NAMES[m],
      monthNumber: m + 1,
      year: selectedYear,
      clients: clientsCount,
      jobs: jobsCount,
      volume: jobsCount,
      formatted: `${clientsCount} clients • ${jobsCount} jobs`,
      isSelected: period === "this_month" && m === selectedMonth,
    });
  }

  // Daily breakdown when period is this_month
  let dailyIncomeOverview: TDailyIncomeItem[] | undefined;
  if (period === "this_month") {
    dailyIncomeOverview = [];
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dayBookings = allCompletedBookings.filter((b) => {
        const date = getBookingEffectiveDate(b);
        return (
          date.getFullYear() === selectedYear &&
          date.getMonth() === selectedMonth &&
          date.getDate() === d
        );
      });

      const dayIncome = dayBookings.reduce(
        (sum, b) => sum + (Number(b.totalAmount) || 0),
        0,
      );
      const dayClients = new Set<string>();
      for (const b of dayBookings) {
        const hId =
          (b.homeowner as any)?._id?.toString() ||
          (b.homeowner as any)?.toString();
        if (hId) dayClients.add(hId);
      }

      const dayPadded = String(d).padStart(2, "0");
      const monthPadded = String(selectedMonth + 1).padStart(2, "0");
      const roundedDayIncome = Math.round(dayIncome * 100) / 100;

      dailyIncomeOverview.push({
        day: d,
        date: `${selectedYear}-${monthPadded}-${dayPadded}`,
        income: roundedDayIncome,
        formattedIncome: `$${roundedDayIncome.toLocaleString("en-US")}`,
        jobs: dayBookings.length,
        clients: dayClients.size,
      });
    }
  }

  // History list from current period
  let historySource = [...currentPeriodBookings];

  // Optional search in history
  const searchTerm = (query.searchTerm || query.search) as string | undefined;
  if (searchTerm && typeof searchTerm === "string" && searchTerm.trim()) {
    const term = searchTerm.trim().toLowerCase();
    historySource = historySource.filter((b: any) => {
      const clientName = (b.homeowner?.name || "").toLowerCase();
      const serviceTitle = (
        b.jobRequest?.headline ||
        b.jobRequest?.title ||
        ""
      ).toLowerCase();
      const paymentMethod = (
        b.settledPaymentMethod ||
        b.paymentMethod ||
        ""
      ).toLowerCase();
      return (
        clientName.includes(term) ||
        serviceTitle.includes(term) ||
        paymentMethod.includes(term)
      );
    });
  }

  // Sort history descending by effective date
  historySource.sort((a: any, b: any) => {
    const dateA = getBookingEffectiveDate(a).getTime();
    const dateB = getBookingEffectiveDate(b).getTime();
    return dateB - dateA;
  });

  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.max(1, Number(query.limit) || 10);
  const totalHistory = historySource.length;
  const totalPage = Math.ceil(totalHistory / limit) || 1;
  const paginatedBookings = historySource.slice(
    (page - 1) * limit,
    page * limit,
  );

  const periodLabel =
    period === "this_month"
      ? "This Month"
      : period === "this_year"
        ? "This Year"
        : "All Time";

  const roundedEarnings = Math.round(currentPeriodEarnings * 100) / 100;

  return {
    period,
    periodLabel,
    year: selectedYear,
    selectedMonth: selectedMonth + 1,
    stats: {
      earnings: roundedEarnings,
      earningsFormatted: `$${roundedEarnings.toLocaleString("en-US")}`,
      earningsGrowth,
      earningsGrowthFormatted,
      completedJobs: currentPeriodBookings.length,
      clients: currentPeriodClientIds.size,
      rating: displayRating,
      totalReviews: displayReviews,
      ratingDetails: {
        averageRating: overallRating,
        totalReviews: overallTotalReviews,
        periodRating: periodAvgRating,
        periodReviews: periodTotalReviews,
        overallRating,
        overallReviews: overallTotalReviews,
      },
    },
    monthlyIncomeOverview,
    clientsAndWorkVolume,
    clientAndWorkVolume: clientsAndWorkVolume,
    dailyIncomeOverview,
  };
};

const getProfessionalHistoryFromDB = async (
  professionalId: string,
  query: Record<string, unknown> = {},
): Promise<TProfessionalHistoryResponse> => {
  assertValidObjectId(professionalId, "professional");
  const professionalObjectId = new mongoose.Types.ObjectId(professionalId);

  const professional = await User.findById(professionalObjectId).lean();
  if (!professional) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Professional not found");
  }

  const period = normalizeAnalyticsPeriod(query.period);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const parsedYear = Number(query.year);
  const selectedYear =
    !isNaN(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100
      ? parsedYear
      : currentYear;

  const parsedMonth = Number(query.month);
  const selectedMonth =
    !isNaN(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12
      ? parsedMonth - 1
      : currentMonth;

  let startDate: Date;
  let endDate: Date;

  if (period === "this_month") {
    startDate = new Date(selectedYear, selectedMonth, 1, 0, 0, 0, 0);
    endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);
  } else if (period === "this_year") {
    startDate = new Date(selectedYear, 0, 1, 0, 0, 0, 0);
    endDate = new Date(selectedYear, 11, 31, 23, 59, 59, 999);
  } else {
    startDate = new Date(0);
    endDate = new Date(selectedYear + 10, 11, 31, 23, 59, 59, 999);
  }

  const completedFilter: Record<string, any> = {
    professional: professionalObjectId,
    isDeleted: { $ne: true },
    status: { $ne: BOOKING_STATUS.CANCELLED },
    $or: [
      { status: BOOKING_STATUS.COMPLETED },
      { paymentStatus: "paid" },
      { homeownerCompletedAt: { $ne: null } },
      { contractorCompletedAt: { $ne: null } },
    ],
  };

  const allCompletedBookings = await Booking.find(completedFilter)
    .populate({
      path: "jobRequest",
      select: "headline title description category serviceLocation",
      populate: { path: "category", select: "name icon" },
    })
    .populate("homeowner", "name email profileImage phone")
    .lean();

  let historySource = allCompletedBookings.filter((b) => {
    const d = getBookingEffectiveDate(b);
    return d >= startDate && d <= endDate;
  });

  const searchTerm = (query.searchTerm || query.search) as string | undefined;
  if (searchTerm && typeof searchTerm === "string" && searchTerm.trim()) {
    const term = searchTerm.trim().toLowerCase();
    historySource = historySource.filter((b: any) => {
      const clientName = (b.homeowner?.name || "").toLowerCase();
      const serviceTitle = (
        b.jobRequest?.headline ||
        b.jobRequest?.title ||
        ""
      ).toLowerCase();
      const paymentMethod = (
        b.settledPaymentMethod ||
        b.paymentMethod ||
        ""
      ).toLowerCase();
      return (
        clientName.includes(term) ||
        serviceTitle.includes(term) ||
        paymentMethod.includes(term)
      );
    });
  }

  historySource.sort((a: any, b: any) => {
    const dateA = getBookingEffectiveDate(a).getTime();
    const dateB = getBookingEffectiveDate(b).getTime();
    return dateB - dateA;
  });

  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.max(1, Number(query.limit) || 10);
  const totalHistory = historySource.length;
  const totalPage = Math.ceil(totalHistory / limit) || 1;
  const paginatedBookings = historySource.slice(
    (page - 1) * limit,
    page * limit,
  );

  const historyData: THistoryItem[] = paginatedBookings.map((b: any) => {
    const effectiveDate = getBookingEffectiveDate(b);
    const homeowner = b.homeowner || {};
    const jobRequest = b.jobRequest || {};
    const totalAmount = Number(b.totalAmount) || 0;

    return {
      _id: b._id?.toString() || "",
      bookingId: b._id?.toString() || "",
      client: {
        _id: homeowner._id?.toString(),
        name: homeowner.name || "Client",
        profileImage: homeowner.profileImage || "",
        email: homeowner.email || "",
        phone: homeowner.phone || "",
      },
      clientName: homeowner.name || "Client",
      clientImage: homeowner.profileImage || "",
      serviceTitle: jobRequest.headline || jobRequest.title || "Service",
      category: jobRequest.category?.name || "",
      date: effectiveDate,
      formattedDate: formatAnalyticsHistoryDate(effectiveDate),
      amount: totalAmount,
      formattedAmount: `$${totalAmount.toLocaleString("en-US")}`,
      status: b.status || BOOKING_STATUS.COMPLETED,
      paymentMethod: b.settledPaymentMethod || b.paymentMethod || "Cash",
      paymentStatus: b.paymentStatus || "paid",
    };
  });

  return {
    meta: {
      page,
      limit,
      total: totalHistory,
      totalPage,
    },
    data: historyData,
  };
};

const getFileNameFromUrl = (url?: string | null): string | null => {
  if (!url) return null;
  const parts = url.split(/[/\\]/);
  return parts[parts.length - 1] || null;
};

const getBackgroundCheckStatusInfo = (bg?: any) => {
  const isCleared = Boolean(
    bg?.passed === true ||
      bg?.status === CHECKR_VERIFICATION_STATUS.VERIFIED,
  );

  let statusLabel = "Not Started";
  if (isCleared) {
    statusLabel = "Cleared";
  } else if (bg?.status === CHECKR_VERIFICATION_STATUS.PENDING) {
    statusLabel = "Pending";
  } else if (bg?.status === CHECKR_VERIFICATION_STATUS.REVIEW_REQUIRED) {
    statusLabel = "Review Required";
  } else if (bg?.status === CHECKR_VERIFICATION_STATUS.FAILED) {
    statusLabel = "Failed";
  } else if (bg?.consentAccepted) {
    statusLabel = "Consent Accepted";
  }

  return {
    status: bg?.status || CHECKR_VERIFICATION_STATUS.NOT_STARTED,
    statusLabel,
    isCleared,
    provider: "Checkr",
    providerDescription: "Verified via Checkr screening",
    checkrInvitationUrl: bg?.checkrInvitationUrl || null,
    viewUrl: bg?.checkrInvitationUrl || null,
    passed: isCleared,
    verifiedAt: bg?.verifiedAt || null,
    notes: bg?.notes || null,
  };
};

const getTradeLicenseStatusInfo = (tl?: any) => {
  const isVerified = Boolean(tl?.isVerified);
  let status = "Not Provided";
  if (isVerified) {
    status = "Verified & Active";
  } else if (tl?.licenseNumber || tl?.certificateUrl) {
    status = "Pending Verification";
  }

  return {
    licenseNumber: tl?.licenseNumber || "",
    state: tl?.state || "",
    issuingState: tl?.state || "",
    status,
    isVerified,
    certificateUrl: tl?.certificateUrl || null,
    fileName: getFileNameFromUrl(tl?.certificateUrl),
  };
};

const getLiabilityInsuranceStatusInfo = (li?: any) => {
  const isVerified = Boolean(li?.isVerified);
  let status = "Not Provided";
  if (isVerified) {
    status = "Verified & Active";
  } else if (li?.carrier || li?.certificateUrl) {
    status = "Pending Verification";
  }

  const coverage =
    li?.coverage !== undefined && li?.coverage !== null
      ? String(li.coverage)
      : "";

  return {
    carrier: li?.carrier || "",
    coverage,
    coverageLimit: coverage,
    status,
    isVerified,
    expires: li?.expires || null,
    certificateUrl: li?.certificateUrl || null,
    fileName: getFileNameFromUrl(li?.certificateUrl),
  };
};

const getProfessionalApplicationFromDB = async (
  userId: string,
): Promise<TProfessionalApplicationResponse> => {
  assertValidObjectId(userId, "user");

  const user = await User.findById(userId)
    .select(
      "approvalStatus rejectionReason tradeLicense liabilityInsurance backgroundCheck state",
    )
    .lean();

  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Professional not found");
  }

  return {
    approvalStatus: user.approvalStatus || APPROVAL_STATUS.PENDING,
    rejectionReason: user.rejectionReason || null,
    backgroundCheck: getBackgroundCheckStatusInfo(user.backgroundCheck),
    tradeLicense: getTradeLicenseStatusInfo({
      ...user.tradeLicense,
      state: user.tradeLicense?.state || user.state,
    }),
    liabilityInsurance: getLiabilityInsuranceStatusInfo(user.liabilityInsurance),
  };
};

export const ProfessionalService = {
  getAllProfessionalsFromDB,
  getTopRatedProfessionalsFromDB,
  getProfessionalDetailsFromDB,
  getProfessionalAnalyticsFromDB,
  getProfessionalHistoryFromDB,
  getProfessionalApplicationFromDB,
};
