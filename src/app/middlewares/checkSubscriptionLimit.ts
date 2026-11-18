import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import ApiError from "../../errors/ApiErrors";
import { USER_ROLES } from "../../enums/user";
import {
  getSubscriptionQuotationUsage,
  verifyQuotationSubscriptionGuard,
} from "../modules/subscription/subscription.helper";
import { Subscription } from "../modules/subscription/subscription.model";

/**
 * Generic validator for any active subscription / trial.
 */
export const verifyActiveSubscription = async (userId: string) => {
  const subscription = await Subscription.findOne({
    userId,
    status: { $in: ["active", "trialing"] },
    isDeleted: { $ne: true },
  }).populate("packageId");

  if (!subscription) {
    throw new ApiError(
      StatusCodes.PAYMENT_REQUIRED,
      "You do not have an active subscription or free trial. Please subscribe to a plan.",
      "NO_ACTIVE_SUBSCRIPTION",
    );
  }

  if (
    subscription.status === "trialing" &&
    subscription.trialEndsAt &&
    new Date() > new Date(subscription.trialEndsAt)
  ) {
    throw new ApiError(
      StatusCodes.PAYMENT_REQUIRED,
      "Your free trial period has ended. Please upgrade your subscription.",
      "TRIAL_EXPIRED",
    );
  }

  if (!subscription.packageId) {
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      "Associated subscription package could not be found",
      "PACKAGE_NOT_FOUND",
    );
  }

  return subscription;
};

/**
 * Middleware: Guards quotation creation based on the professional's subscription package and lead quota.
 * Admin and Super Admin roles bypass this check.
 */
export const checkQuotationLimit = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user;

    // Allow admins / super admins to bypass subscription limits
    if (
      user?.role === USER_ROLES.ADMIN ||
      user?.role === USER_ROLES.SUPER_ADMIN
    ) {
      return next();
    }

    const usage = await verifyQuotationSubscriptionGuard(user.id);

    // Attach quota status to request for downstream handlers if needed
    (req as any).subscriptionQuota = usage;

    next();
  } catch (error) {
    next(error);
  }
};

// Aliases for compatibility and reusable naming
export const checkSubscriptionLimit = checkQuotationLimit;
export const checkPropertyLimit = checkQuotationLimit;
export const checkFlatLimit = checkQuotationLimit;

export { getSubscriptionQuotationUsage, verifyQuotationSubscriptionGuard };
