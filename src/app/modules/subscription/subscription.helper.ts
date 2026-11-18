import { Types } from "mongoose";
import { StatusCodes } from "http-status-codes";
import ApiError from "../../../errors/ApiErrors";
import { IPackage } from "../package/package.interface";
import { ISubscription } from "./subscription.interface";
import { Subscription } from "./subscription.model";
import { Quotation } from "../quotation/quotation.model";

export interface TQuotationSubscriptionUsage {
  hasActiveSubscription: boolean;
  canSendQuotation: boolean;
  subscription: ISubscription | null;
  package: IPackage | null;
  leadLimit: number;
  usedQuotations: number;
  remainingQuotations: number | null;
  isUnlimited: boolean;
  isTrial: boolean;
  trialExpired: boolean;
  isExpired: boolean;
  periodStart: Date | null;
  periodEnd: Date | null;
  rejectionReason: string | null;
  errorCode: string | null;
}

/**
 * Calculates current quotation subscription status, quotas, and usage for a professional.
 * Highly reusable across services, controllers, and middlewares.
 */
export const getSubscriptionQuotationUsage = async (
  userId: string | Types.ObjectId,
): Promise<TQuotationSubscriptionUsage> => {
  const proObjectId =
    typeof userId === "string" ? new Types.ObjectId(userId) : userId;

  let subscription = await Subscription.findOne({
    userId: proObjectId,
    isDeleted: { $ne: true },
    status: { $in: ["active", "trialing", "past_due"] },
  })
    .populate<{ packageId: IPackage }>("packageId")
    .sort({ createdAt: -1 });

  // If no active or trialing subscription found
  if (!subscription) {
    return {
      hasActiveSubscription: false,
      canSendQuotation: false,
      subscription: null,
      package: null,
      leadLimit: 0,
      usedQuotations: 0,
      remainingQuotations: 0,
      isUnlimited: false,
      isTrial: false,
      trialExpired: false,
      isExpired: true,
      periodStart: null,
      periodEnd: null,
      rejectionReason:
        "You do not have an active subscription or free trial. Please subscribe to a package to send quotations.",
      errorCode: "NO_ACTIVE_SUBSCRIPTION",
    };
  }

  const now = new Date();

  // Auto-apply upcoming scheduled plan if effectiveDate has passed
  if (
    subscription.upcomingPlan &&
    subscription.upcomingPlan.status === "scheduled" &&
    now >= new Date(subscription.upcomingPlan.effectiveDate)
  ) {
    subscription.packageId = subscription.upcomingPlan.packageId as any;
    subscription.planType = subscription.upcomingPlan.planType;
    subscription.currentPeriodStart = subscription.upcomingPlan.effectiveDate;

    const newEnd = new Date(subscription.currentPeriodStart);
    if (subscription.planType === "yearly") {
      newEnd.setFullYear(newEnd.getFullYear() + 1);
    } else {
      newEnd.setMonth(newEnd.getMonth() + 1);
    }
    subscription.currentPeriodEnd = newEnd;
    subscription.upcomingPlan.status = "applied";

    await subscription.save();
    await subscription.populate("packageId");
  }

  // Check trial expiration
  const isTrial = Boolean(
    subscription.status === "trialing" || subscription.isTrial,
  );
  const trialExpired = Boolean(
    isTrial &&
      subscription.trialEndsAt &&
      now > new Date(subscription.trialEndsAt),
  );

  if (trialExpired) {
    return {
      hasActiveSubscription: false,
      canSendQuotation: false,
      subscription,
      package: subscription.packageId as unknown as IPackage,
      leadLimit: (subscription.packageId as any)?.leadLimit ?? 0,
      usedQuotations: 0,
      remainingQuotations: 0,
      isUnlimited: false,
      isTrial: true,
      trialExpired: true,
      isExpired: true,
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
      rejectionReason:
        "Your free trial period has ended. Please subscribe to a paid package to continue sending quotations.",
      errorCode: "TRIAL_EXPIRED",
    };
  }

  // Check past_due / unpaid status
  if (subscription.status === "past_due" || subscription.status === "unpaid") {
    return {
      hasActiveSubscription: false,
      canSendQuotation: false,
      subscription,
      package: subscription.packageId as unknown as IPackage,
      leadLimit: (subscription.packageId as any)?.leadLimit ?? 0,
      usedQuotations: 0,
      remainingQuotations: 0,
      isUnlimited: false,
      isTrial,
      trialExpired: false,
      isExpired: false,
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
      rejectionReason:
        "Your subscription payment is past due. Please update your billing method to send quotations.",
      errorCode: "SUBSCRIPTION_PAST_DUE",
    };
  }

  // Check period expiration
  const periodEnd = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd)
    : null;
  const isExpired = Boolean(
    periodEnd && now > periodEnd && subscription.status !== "active",
  );

  if (isExpired) {
    return {
      hasActiveSubscription: false,
      canSendQuotation: false,
      subscription,
      package: subscription.packageId as unknown as IPackage,
      leadLimit: (subscription.packageId as any)?.leadLimit ?? 0,
      usedQuotations: 0,
      remainingQuotations: 0,
      isUnlimited: false,
      isTrial,
      trialExpired: false,
      isExpired: true,
      periodStart: subscription.currentPeriodStart,
      periodEnd,
      rejectionReason:
        "Your subscription period has ended. Please renew or upgrade your plan to send quotations.",
      errorCode: "SUBSCRIPTION_EXPIRED",
    };
  }

  // Verify associated package
  const pkg = subscription.packageId as unknown as IPackage;
  if (!pkg || pkg.isDeleted) {
    return {
      hasActiveSubscription: false,
      canSendQuotation: false,
      subscription,
      package: null,
      leadLimit: 0,
      usedQuotations: 0,
      remainingQuotations: 0,
      isUnlimited: false,
      isTrial,
      trialExpired: false,
      isExpired: false,
      periodStart: subscription.currentPeriodStart,
      periodEnd,
      rejectionReason:
        "The subscription package associated with your account is inactive or not found.",
      errorCode: "PACKAGE_NOT_FOUND",
    };
  }

  // Determine quote / lead limit (-1 = unlimited)
  const leadLimit = typeof pkg.leadLimit === "number" ? pkg.leadLimit : -1;
  const isUnlimited = leadLimit === -1;

  // Determine active billing window
  const periodStart = subscription.currentPeriodStart
    ? new Date(subscription.currentPeriodStart)
    : subscription.trialStartsAt
      ? new Date(subscription.trialStartsAt)
      : new Date(now.getFullYear(), now.getMonth(), 1);

  // Count non-deleted quotations sent by this professional during the current active cycle
  const usedQuotations = await Quotation.countDocuments({
    professional: proObjectId,
    createdAt: {
      $gte: periodStart,
      ...(periodEnd ? { $lte: periodEnd } : {}),
    },
    isDeleted: { $ne: true },
  });

  const remainingQuotations = isUnlimited
    ? null
    : Math.max(0, leadLimit - usedQuotations);

  const limitExceeded = !isUnlimited && usedQuotations >= leadLimit;
  const canSendQuotation = !limitExceeded;

  return {
    hasActiveSubscription: true,
    canSendQuotation,
    subscription,
    package: pkg,
    leadLimit,
    usedQuotations,
    remainingQuotations,
    isUnlimited,
    isTrial,
    trialExpired: false,
    isExpired: false,
    periodStart,
    periodEnd,
    rejectionReason: limitExceeded
      ? `You have reached your quotation limit of ${leadLimit} (${usedQuotations}/${leadLimit} used) for this billing period. Please upgrade your subscription package to send more quotations.`
      : null,
    errorCode: limitExceeded ? "QUOTATION_LIMIT_REACHED" : null,
  };
};

/**
 * Guard function to assert that a professional is eligible to submit a quotation.
 * Throws ApiError if ineligible.
 */
export const verifyQuotationSubscriptionGuard = async (
  userId: string | Types.ObjectId,
): Promise<TQuotationSubscriptionUsage> => {
  const usage = await getSubscriptionQuotationUsage(userId);

  if (!usage.hasActiveSubscription) {
    throw new ApiError(
      StatusCodes.PAYMENT_REQUIRED,
      usage.rejectionReason ||
        "You do not have an active subscription or free trial. Please subscribe to a package.",
      usage.errorCode || "SUBSCRIPTION_REQUIRED",
    );
  }

  if (!usage.canSendQuotation) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      usage.rejectionReason ||
        "You have reached your quotation limit for this billing period.",
      usage.errorCode || "QUOTATION_LIMIT_REACHED",
    );
  }

  return usage;
};

