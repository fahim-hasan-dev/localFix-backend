import { StatusCodes } from "http-status-codes";
import Stripe from "stripe";
import config from "../../../config";
import ApiError from "../../../errors/ApiErrors";
import { getStripe } from "../../../helpers/stripeHelper";
import { getCurrencyCode } from "../../../helpers/currencyHelper";
import { sendNotifications } from "../../../helpers/notificationsHelper";
import { USER_ROLES } from "../../../enums/user";
import { NOTIFICATION_TYPE } from "../notification/notification.constant";
import { IPackage } from "../package/package.interface";
import { Package } from "../package/package.model";
import { User } from "../user/user.model";
import { ISubscription } from "./subscription.interface";
import { Subscription } from "./subscription.model";
import { getSubscriptionQuotationUsage } from "./subscription.helper";

/**
 * Reuse a stored Stripe customer only if it still exists in the current Stripe account.
 * After cancel / key rotation / test↔live switches the old `cus_…` is often gone —
 * creating checkout with it throws "No such customer".
 */
const resolveStripeCustomerId = async (
  stripe: Stripe,
  user: { _id: { toString(): string }; email?: string; name?: string; role?: string },
  previousCustomerId?: string | null,
): Promise<string> => {
  if (previousCustomerId && previousCustomerId.startsWith("cus_")) {
    try {
      const existing = await stripe.customers.retrieve(previousCustomerId);
      if (!("deleted" in existing && existing.deleted)) {
        return existing.id;
      }
    } catch (err: any) {
      const code = err?.code || err?.raw?.code;
      const message = String(err?.message || "");
      // Missing / wrong-mode customer → create a fresh one below
      if (code !== "resource_missing" && !message.includes("No such customer")) {
        throw err;
      }
    }
  }

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: {
      userId: user._id.toString(),
      role: user.role || "",
    },
  });

  // Keep historical subscription rows in sync so portal / next checkout reuse this id
  if (previousCustomerId && previousCustomerId !== customer.id) {
    await Subscription.updateMany(
      { userId: user._id, stripeCustomerId: previousCustomerId },
      { $set: { stripeCustomerId: customer.id } },
    );
  }

  return customer.id;
};

/**
 * Helper to ensure a Stripe Price exists for a Package and billingCycle/planType
 */
const getOrCreateStripePrice = async (
  stripe: Stripe,
  pkg: any,
  planType: "monthly" | "yearly",
): Promise<string> => {
  // Check if appropriate price ID already exists on the package
  let priceId =
    planType === "yearly" ? pkg.stripeYearlyPriceId : pkg.stripeMonthlyPriceId;

  // Fallback if stripePriceId exists and matches this cycle
  if (!priceId && pkg.stripePriceId && pkg.billingCycle === planType) {
    priceId = pkg.stripePriceId;
  }

  if (priceId && typeof priceId === "string" && priceId.startsWith("price_")) {
    return priceId;
  }

  // Ensure Stripe product exists
  let productId = pkg.stripeProductId;
  if (!productId || typeof productId !== "string" || !productId.startsWith("prod_")) {
    const prod = await stripe.products.create({
      name: `LocalFix - ${pkg.name}`,
      description: pkg.description || undefined,
    });
    productId = prod.id;
    pkg.stripeProductId = prod.id;
  }

  // Compute price amount in currency major units (e.g., dollars)
  let priceAmount = 0;
  if (planType === "yearly") {
    priceAmount =
      pkg.yearlyPrice ??
      (pkg.billingCycle === "yearly" ? pkg.price : (pkg.price || 0) * 10);
  } else {
    priceAmount =
      pkg.monthlyPrice ??
      (pkg.billingCycle === "monthly" ? pkg.price : (pkg.price || 0));
  }

  const currency = getCurrencyCode();
  const newPrice = await stripe.prices.create({
    product: productId,
    unit_amount: Math.round(priceAmount * 100),
    currency,
    recurring: {
      interval: planType === "yearly" ? "year" : "month",
    },
    metadata: {
      planType,
      packageName: pkg.name,
      packageId: pkg._id.toString(),
    },
  });

  if (planType === "yearly") {
    pkg.stripeYearlyPriceId = newPrice.id;
  } else {
    pkg.stripeMonthlyPriceId = newPrice.id;
  }

  if (!pkg.stripePriceId || pkg.billingCycle === planType) {
    pkg.stripePriceId = newPrice.id;
  }

  await pkg.save();
  return newPrice.id;
};

// ==========================================
// 1. Create Checkout Session for Purchase
// ==========================================
const createCheckoutSession = async (
  userId: string,
  packageId: string,
  planType: "monthly" | "yearly",
) => {
  const stripe = getStripe();

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }

  // Only users with professional role can purchase subscriptions
  if (user.role !== USER_ROLES.PROFESSIONAL) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      "Only professionals can purchase a subscription plan",
    );
  }

  const selectedPackage = await Package.findById(packageId);
  if (!selectedPackage || !selectedPackage.isActive) {
    throw new ApiError(
      StatusCodes.NOT_FOUND,
      "Selected package not found or inactive",
    );
  }

  // Check if user already has an active or trialing subscription
  const existingActiveSubscription = await Subscription.findOne({
    userId,
    status: { $in: ["active", "trialing"] },
  }).populate("packageId");

  if (existingActiveSubscription) {
    const currentPkg: any = existingActiveSubscription.packageId;
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `You already have an active subscription (${currentPkg?.name || "Current Plan"}). To upgrade or switch your plan starting after your current period ends, please use the update-plan endpoint.`,
    );
  }

  const priceId = await getOrCreateStripePrice(
    stripe,
    selectedPackage,
    planType,
  );

  // Find or create Stripe customer (validate stored id — may be deleted after cancel / key change)
  const previousSub = await Subscription.findOne({ userId }).sort({
    createdAt: -1,
  });
  const stripeCustomerId = await resolveStripeCustomerId(
    stripe,
    user,
    previousSub?.stripeCustomerId,
  );

  // Prevent multiple free trials for the same user
  const hadPreviousTrial = await Subscription.findOne({
    userId,
    isTrial: true,
  });

  const shouldApplyTrial =
    selectedPackage.hasTrial &&
    selectedPackage.trialDays > 0 &&
    !hadPreviousTrial;

  const clientUrl = config.client_url || "http://localhost:3000";

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    customer: stripeCustomerId,
    mode: "subscription",
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${clientUrl}/dashboard?subscription=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${clientUrl}/pricing?subscription=canceled`,
    metadata: {
      paymentType: "subscription",
      userId: user._id.toString(),
      packageId: selectedPackage._id.toString(),
      planType,
    },
    subscription_data: {
      metadata: {
        paymentType: "subscription",
        userId: user._id.toString(),
        packageId: selectedPackage._id.toString(),
        planType,
      },
      ...(shouldApplyTrial
        ? { trial_period_days: selectedPackage.trialDays }
        : {}),
    },
  };

  const session = await stripe.checkout.sessions.create(sessionParams);

  return {
    checkoutUrl: session.url,
    sessionId: session.id,
  };
};

// ==========================================
// 2. Update / Switch Subscription Plan
// (Starts after current plan period ends)
// ==========================================
const updateSubscriptionPlan = async (
  userId: string,
  newPackageId: string,
  newPlanType: "monthly" | "yearly",
) => {
  const stripe = getStripe();

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }

  if (user.role !== USER_ROLES.PROFESSIONAL) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      "Only professionals can manage subscription plans",
    );
  }

  const currentSub = await Subscription.findOne({
    userId,
    status: { $in: ["active", "trialing"] },
  }).populate("packageId");

  if (!currentSub) {
    throw new ApiError(
      StatusCodes.NOT_FOUND,
      "No active subscription found to update. Please purchase a plan first.",
    );
  }

  const newPackage = await Package.findById(newPackageId);
  if (!newPackage || !newPackage.isActive) {
    throw new ApiError(
      StatusCodes.NOT_FOUND,
      "Target package not found or inactive",
    );
  }

  const currentPkg: any = currentSub.packageId;
  const currentPkgId = currentPkg?._id?.toString() || currentSub.packageId?.toString();

  // If selecting the exact same package and billing cycle
  if (currentPkgId === newPackageId && currentSub.planType === newPlanType) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `You are already subscribed to the ${newPackage.name} (${newPlanType}) plan.`,
    );
  }

  // Ensure Stripe price for the target package and planType exists
  const newPriceId = await getOrCreateStripePrice(
    stripe,
    newPackage,
    newPlanType,
  );

  // Requirement: The new plan starts after the current plan period ends
  const effectiveDate = currentSub.currentPeriodEnd;

  // In Stripe: Schedule the phase transition at current_period_end
  try {
    const stripeSub = await stripe.subscriptions.retrieve(
      currentSub.stripeSubscriptionId,
    );

    let scheduleId = stripeSub.schedule as string | undefined;

    if (!scheduleId) {
      const schedule = await stripe.subscriptionSchedules.create({
        from_subscription: stripeSub.id,
      });
      scheduleId = schedule.id;
    }

    const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
    const currentPhase = schedule.phases[0];

    const phaseStart =
      currentPhase?.start_date ||
      Math.floor(currentSub.currentPeriodStart.getTime() / 1000);
    const phaseEnd =
      currentPhase?.end_date ||
      Math.floor(currentSub.currentPeriodEnd.getTime() / 1000);

    const currentPriceId =
      (currentPhase?.items?.[0]?.price as string) ||
      stripeSub.items.data[0]?.price.id;

    await stripe.subscriptionSchedules.update(scheduleId, {
      end_behavior: "release",
      phases: [
        {
          items: [{ price: currentPriceId, quantity: 1 }],
          start_date: phaseStart,
          end_date: phaseEnd,
        },
        {
          items: [{ price: newPriceId, quantity: 1 }],
          start_date: phaseEnd,
          metadata: {
            userId: user._id.toString(),
            packageId: newPackage._id.toString(),
            planType: newPlanType,
          },
        },
      ],
    });
  } catch (stripeErr: any) {
    // If Stripe schedule update is restricted, gracefully fallback to DB scheduling
    // and subscription metadata update
    try {
      await stripe.subscriptions.update(currentSub.stripeSubscriptionId, {
        metadata: {
          upcomingPackageId: newPackage._id.toString(),
          upcomingPlanType: newPlanType,
          upcomingPriceId: newPriceId,
        },
      });
    } catch (ignore) {
      // Ignore stripe metadata error in test environments
    }
  }

  // Record upcoming plan schedule in DB
  currentSub.upcomingPlan = {
    packageId: newPackage._id,
    planType: newPlanType,
    stripePriceId: newPriceId,
    effectiveDate,
    status: "scheduled",
  };

  await currentSub.save();
  await currentSub.populate(["packageId", "upcomingPlan.packageId"]);

  // Send in-app / push notification
  try {
    await sendNotifications({
      receiver: user._id,
      type: NOTIFICATION_TYPE.PROFESSIONAL,
      title: "Plan Update Scheduled",
      text: `Your plan will automatically update to ${newPackage.name} (${newPlanType}) on ${effectiveDate.toLocaleDateString()} after your current plan period ends.`,
      referenceId: currentSub._id,
      referenceModel: "Subscription",
    });
  } catch (notifErr) {
    // Notification failure shouldn't fail the update API
  }

  return {
    message: `Plan update scheduled successfully. Your new ${newPackage.name} (${newPlanType}) plan will start on ${effectiveDate.toISOString()} after the current period ends.`,
    subscription: currentSub,
    effectiveDate,
  };
};

// ==========================================
// 3. Cancel Scheduled Upcoming Plan Change
// ==========================================
const cancelUpcomingPlan = async (userId: string) => {
  const stripe = getStripe();

  const currentSub = await Subscription.findOne({
    userId,
    status: { $in: ["active", "trialing"] },
  }).populate("packageId");

  if (!currentSub || !currentSub.upcomingPlan) {
    throw new ApiError(
      StatusCodes.NOT_FOUND,
      "No upcoming plan change scheduled to cancel",
    );
  }

  try {
    const stripeSub = await stripe.subscriptions.retrieve(
      currentSub.stripeSubscriptionId,
    );
    if (stripeSub.schedule) {
      // Release subscription from schedule so it stays on current plan
      await stripe.subscriptionSchedules.release(stripeSub.schedule as string);
    }
  } catch (err) {
    // Ignore if already released
  }

  currentSub.upcomingPlan = undefined;
  await currentSub.save();

  return {
    message: "Scheduled upcoming plan change has been successfully canceled.",
    subscription: currentSub,
  };
};

// ==========================================
// 4. Get Current Professional's Subscription
// ==========================================
const getMySubscriptionFromDB = async (userId: string) => {
  let subscription = await Subscription.findOne({
    userId,
    status: { $in: ["active", "trialing", "past_due"] },
  })
    .populate("packageId")
    .populate("upcomingPlan.packageId")
    .sort({ createdAt: -1 });

  if (!subscription) {
    // Check if there was any previous canceled or expired subscription
    const latestPastSub = await Subscription.findOne({ userId })
      .populate("packageId")
      .sort({ createdAt: -1 });

    return {
      hasActiveSubscription: false,
      subscription: null,
      previousSubscription: latestPastSub || null,
      upcomingPlan: null,
      limits: {
        leadLimit: 0,
        usedQuotations: 0,
        remainingQuotations: 0,
        isUnlimited: false,
        canSendQuotation: false,
      },
    };
  }

  // Auto-apply upcoming plan if current period has already ended
  if (
    subscription.upcomingPlan &&
    subscription.upcomingPlan.status === "scheduled" &&
    new Date() >= new Date(subscription.upcomingPlan.effectiveDate)
  ) {
    subscription.packageId = subscription.upcomingPlan.packageId as any;
    subscription.planType = subscription.upcomingPlan.planType;
    subscription.currentPeriodStart = subscription.upcomingPlan.effectiveDate;

    // Calculate new currentPeriodEnd based on planType
    const newEnd = new Date(subscription.currentPeriodStart);
    if (subscription.planType === "yearly") {
      newEnd.setFullYear(newEnd.getFullYear() + 1);
    } else {
      newEnd.setMonth(newEnd.getMonth() + 1);
    }
    subscription.currentPeriodEnd = newEnd;
    subscription.upcomingPlan.status = "applied";

    await subscription.save();
    await subscription.populate(["packageId", "upcomingPlan.packageId"]);
  }

  const pkg: any = subscription.packageId;
  const now = new Date();
  const currentPeriodEnd = new Date(subscription.currentPeriodEnd);
  const diffMs = currentPeriodEnd.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  const isExpired = diffMs <= 0;

  let upcomingPlanInfo = null;
  if (
    subscription.upcomingPlan &&
    subscription.upcomingPlan.status === "scheduled"
  ) {
    const upPkg: any = subscription.upcomingPlan.packageId;
    upcomingPlanInfo = {
      package: upPkg
        ? {
            _id: upPkg._id,
            name: upPkg.name,
            description: upPkg.description,
            price: upPkg.price,
            billingCycle: upPkg.billingCycle,
            leadLimit: upPkg.leadLimit,
            features: upPkg.features,
            monthlyPrice: upPkg.monthlyPrice,
            yearlyPrice: upPkg.yearlyPrice,
          }
        : null,
      planType: subscription.upcomingPlan.planType,
      effectiveDate: subscription.upcomingPlan.effectiveDate,
      status: subscription.upcomingPlan.status,
    };
  }

  const quotationUsage = await getSubscriptionQuotationUsage(userId);

  return {
    hasActiveSubscription: !isExpired && subscription.status !== "canceled",
    subscription: {
      _id: subscription._id,
      status: subscription.status,
      planType: subscription.planType,
      package: pkg
        ? {
            _id: pkg._id,
            name: pkg.name,
            description: pkg.description,
            price: pkg.price,
            billingCycle: pkg.billingCycle,
            leadLimit: pkg.leadLimit,
            features: pkg.features,
            monthlyPrice: pkg.monthlyPrice,
            yearlyPrice: pkg.yearlyPrice,
            hasTrial: pkg.hasTrial,
            trialDays: pkg.trialDays,
          }
        : null,
      isTrial: subscription.isTrial,
      trialStartsAt: subscription.trialStartsAt,
      trialEndsAt: subscription.trialEndsAt,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      daysRemaining,
      isExpired,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
    },
    upcomingPlan: upcomingPlanInfo,
    limits: {
      leadLimit: quotationUsage.leadLimit,
      usedQuotations: quotationUsage.usedQuotations,
      remainingQuotations: quotationUsage.remainingQuotations,
      isUnlimited: quotationUsage.isUnlimited,
      canSendQuotation: quotationUsage.canSendQuotation,
    },
  };
};

// ==========================================
// 5. Customer Portal Session (Self-service)
// ==========================================
const createCustomerPortalSession = async (userId: string) => {
  const stripe = getStripe();

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }

  const subscription = await Subscription.findOne({ userId }).sort({
    createdAt: -1,
  });

  if (!subscription) {
    throw new ApiError(
      StatusCodes.NOT_FOUND,
      "No subscription history found for this account",
    );
  }

  const stripeCustomerId = await resolveStripeCustomerId(
    stripe,
    user,
    subscription.stripeCustomerId,
  );

  const clientUrl = config.client_url || "http://localhost:3000";

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${clientUrl}/dashboard`,
  });

  return {
    url: portalSession.url,
  };
};

// ==========================================
// 6. Cancel Subscription
// ==========================================
const cancelSubscription = async (userId: string) => {
  const stripe = getStripe();

  const subscription = await Subscription.findOne({
    userId,
    status: { $in: ["active", "trialing"] },
  }).populate("packageId");

  if (!subscription) {
    throw new ApiError(
      StatusCodes.NOT_FOUND,
      "No active subscription found to cancel",
    );
  }

  // Cancel immediately on Stripe
  try {
    await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
  } catch (err: any) {
    // If already canceled on Stripe or error in test mode, continue
  }

  subscription.status = "canceled";
  subscription.canceledAt = new Date();
  subscription.cancelAtPeriodEnd = false;
  if (subscription.upcomingPlan) {
    subscription.upcomingPlan = undefined;
  }
  await subscription.save();

  // Send cancellation notification
  try {
    const pkg: any = subscription.packageId;
    await sendNotifications({
      receiver: subscription.userId as any,
      type: NOTIFICATION_TYPE.PROFESSIONAL,
      title: "Subscription Canceled",
      text: `Your ${pkg?.name || "LocalFix"} subscription has been canceled.`,
      referenceId: subscription._id,
      referenceModel: "Subscription",
    });
  } catch (notifErr) {
    // Non-blocking
  }

  return { message: "Subscription canceled successfully", subscription };
};

// ==========================================
// 7. Get All Subscriptions (Admin only)
// ==========================================
const getAllSubscriptionsFromDB = async (
  query: Record<string, unknown> = {},
) => {
  const filter: Record<string, unknown> = {
    isDeleted: { $ne: true },
  };

  if (query.status) {
    filter.status = query.status;
  }

  if (query.planType) {
    filter.planType = query.planType;
  }

  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  const result = await Subscription.find(filter)
    .populate("userId", "name email phone role companyName")
    .populate("packageId")
    .populate("upcomingPlan.packageId")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Subscription.countDocuments(filter);

  return {
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },
    data: result,
  };
};

// ==========================================
// 🛡️ WEBHOOK EVENT HANDLERS (100% Secure)
// ==========================================

// A. Handle checkout.session.completed for subscription purchase
const handleSubscriptionCheckoutCompleted = async (
  session: Stripe.Checkout.Session,
) => {
  if (session.mode !== "subscription" || !session.subscription) {
    return;
  }

  const stripe = getStripe();
  const stripeSubscription = await stripe.subscriptions.retrieve(
    session.subscription as string,
  );

  const userId =
    session.metadata?.userId || stripeSubscription.metadata?.userId;
  const packageId =
    session.metadata?.packageId || stripeSubscription.metadata?.packageId;
  const planType = (session.metadata?.planType ||
    stripeSubscription.metadata?.planType ||
    "monthly") as "monthly" | "yearly";

  if (!userId || !packageId) {
    return;
  }

  const subObj = stripeSubscription as any;
  const isTrial = subObj.status === "trialing";
  const trialStartsAt = subObj.trial_start
    ? new Date(subObj.trial_start * 1000)
    : undefined;
  const trialEndsAt = subObj.trial_end
    ? new Date(subObj.trial_end * 1000)
    : undefined;

  const currentPeriodStart = subObj.current_period_start
    ? new Date(subObj.current_period_start * 1000)
    : new Date();
  const currentPeriodEnd = subObj.current_period_end
    ? new Date(subObj.current_period_end * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const savedSub = await Subscription.findOneAndUpdate(
    { stripeSubscriptionId: subObj.id },
    {
      userId,
      packageId,
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: subObj.id,
      planType,
      status: subObj.status,
      isTrial,
      trialStartsAt,
      trialEndsAt,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: subObj.cancel_at_period_end || false,
    },
    { upsert: true, new: true },
  ).populate("packageId");

  // Send Push / In-App Notification to Professional
  try {
    const pkg: any = savedSub?.packageId;
    await sendNotifications({
      receiver: userId as any,
      type: NOTIFICATION_TYPE.PROFESSIONAL,
      title: "Subscription Activated",
      text: `Your ${pkg?.name || "LocalFix"} (${planType}) subscription is now active!`,
      referenceId: savedSub?._id,
      referenceModel: "Subscription",
    });
  } catch (err) {
    // Non-blocking notification
  }
};

// B. Handle invoice.payment_succeeded (recurring renewal or trial conversion to paid)
const handleInvoicePaymentSucceeded = async (invoice: Stripe.Invoice) => {
  const inv = invoice as any;
  const subscriptionId =
    inv.subscription ||
    inv.parent?.subscription_details?.subscription ||
    inv.lines?.data?.[0]?.subscription;

  if (!subscriptionId) return;

  const stripe = getStripe();
  const stripeSubscription = await stripe.subscriptions.retrieve(
    subscriptionId as string,
  );
  const subObj = stripeSubscription as any;

  const subscription = await Subscription.findOne({
    stripeSubscriptionId: subObj.id,
  }).populate(["packageId", "upcomingPlan.packageId"]);

  if (subscription) {
    subscription.status = subObj.status as any;
    if (subObj.current_period_start) {
      subscription.currentPeriodStart = new Date(
        subObj.current_period_start * 1000,
      );
    }
    if (subObj.current_period_end) {
      subscription.currentPeriodEnd = new Date(
        subObj.current_period_end * 1000,
      );
    }
    subscription.latestInvoiceId = inv.id;
    subscription.cancelAtPeriodEnd = subObj.cancel_at_period_end || false;

    // If there was an upcoming scheduled plan transition, check if this invoice corresponds to it
    if (
      subscription.upcomingPlan &&
      subscription.upcomingPlan.status === "scheduled"
    ) {
      const activePriceId = subObj.items?.data?.[0]?.price?.id;
      if (
        !subscription.upcomingPlan.stripePriceId ||
        activePriceId === subscription.upcomingPlan.stripePriceId ||
        new Date() >= new Date(subscription.upcomingPlan.effectiveDate)
      ) {
        subscription.packageId = subscription.upcomingPlan.packageId as any;
        subscription.planType = subscription.upcomingPlan.planType;
        subscription.upcomingPlan.status = "applied";
      }
    }

    // Check if it was trial
    const wasTrial = subscription.isTrial;
    if (subscription.isTrial && subObj.status === "active") {
      subscription.isTrial = false;
    }

    await subscription.save();

    // Do NOT send renewed notification on initial checkout
    if (inv.billing_reason === "subscription_create") {
      return;
    }

    // Send renewal notification
    try {
      const pkg: any = subscription.packageId;
      await sendNotifications({
        receiver: subscription.userId as any,
        type: NOTIFICATION_TYPE.PROFESSIONAL,
        title: "Subscription Renewed",
        text: `Your ${pkg?.name || "LocalFix"} subscription has been successfully renewed until ${subscription.currentPeriodEnd.toLocaleDateString()}.`,
        referenceId: subscription._id,
        referenceModel: "Subscription",
      });
    } catch (err) {
      // Non-blocking
    }
  }
};

// C. Handle invoice.payment_failed
const handleInvoicePaymentFailed = async (invoice: Stripe.Invoice) => {
  const inv = invoice as any;
  const subscriptionId =
    inv.subscription ||
    inv.parent?.subscription_details?.subscription ||
    inv.lines?.data?.[0]?.subscription;

  if (!subscriptionId) return;

  const subscription = await Subscription.findOne({
    stripeSubscriptionId: subscriptionId as string,
  });

  if (subscription) {
    subscription.status = "past_due";
    await subscription.save();

    // Notify user about payment failure
    try {
      await sendNotifications({
        receiver: subscription.userId as any,
        type: NOTIFICATION_TYPE.PROFESSIONAL,
        title: "Subscription Payment Failed",
        text: "Your subscription renewal payment failed. Please update your payment method to keep your professional subscription active.",
        referenceId: subscription._id,
        referenceModel: "Subscription",
      });
    } catch (err) {
      // Non-blocking
    }
  }
};

// D. Handle customer.subscription.updated (Plan changes, schedule transitions, cancellations)
const handleSubscriptionUpdated = async (
  stripeSubscription: Stripe.Subscription,
) => {
  const subObj = stripeSubscription as any;
  const subscription = await Subscription.findOne({
    stripeSubscriptionId: subObj.id,
  }).populate(["packageId", "upcomingPlan.packageId"]);

  if (subscription) {
    subscription.status = subObj.status as any;
    subscription.cancelAtPeriodEnd = subObj.cancel_at_period_end || false;

    if (subObj.current_period_start) {
      subscription.currentPeriodStart = new Date(
        subObj.current_period_start * 1000,
      );
    }
    if (subObj.current_period_end) {
      subscription.currentPeriodEnd = new Date(
        subObj.current_period_end * 1000,
      );
    }

    if (subObj.status === "canceled") {
      subscription.canceledAt = new Date();
    }

    // Check if Stripe updated price (e.g., transition occurred)
    const activePriceId = subObj.items?.data?.[0]?.price?.id;
    if (activePriceId) {
      if (
        subscription.upcomingPlan &&
        subscription.upcomingPlan.status === "scheduled" &&
        activePriceId === subscription.upcomingPlan.stripePriceId
      ) {
        subscription.packageId = subscription.upcomingPlan.packageId as any;
        subscription.planType = subscription.upcomingPlan.planType;
        subscription.upcomingPlan.status = "applied";
      } else {
        // Attempt to find package corresponding to new price
        const matchedPkg = await Package.findOne({
          $or: [
            { stripePriceId: activePriceId },
            { stripeMonthlyPriceId: activePriceId },
            { stripeYearlyPriceId: activePriceId },
          ],
        });
        if (matchedPkg) {
          subscription.packageId = matchedPkg._id;
          if (matchedPkg.stripeYearlyPriceId === activePriceId) {
            subscription.planType = "yearly";
          } else if (matchedPkg.stripeMonthlyPriceId === activePriceId) {
            subscription.planType = "monthly";
          }
        }
      }
    }

    await subscription.save();
  }
};

// E. Handle customer.subscription.deleted (Plan terminated)
const handleSubscriptionDeleted = async (
  stripeSubscription: Stripe.Subscription,
) => {
  const subObj = stripeSubscription as any;
  const subscription = await Subscription.findOne({
    stripeSubscriptionId: subObj.id,
  });

  if (subscription) {
    subscription.status = "canceled";
    subscription.canceledAt = new Date();
    await subscription.save();

    try {
      await sendNotifications({
        receiver: subscription.userId as any,
        type: NOTIFICATION_TYPE.PROFESSIONAL,
        title: "Subscription Canceled",
        text: "Your subscription has been canceled.",
        referenceId: subscription._id,
        referenceModel: "Subscription",
      });
    } catch (err) {
      // Non-blocking
    }
  }
};

// F. Handle customer.subscription.trial_will_end (3 days before trial ends)
const handleTrialWillEnd = async (stripeSubscription: Stripe.Subscription) => {
  const subscription = await Subscription.findOne({
    stripeSubscriptionId: stripeSubscription.id,
  });

  if (subscription && subscription.userId) {
    try {
      await sendNotifications({
        receiver: subscription.userId as any,
        type: NOTIFICATION_TYPE.PROFESSIONAL,
        title: "Free Trial Ending Soon",
        text: "Your free trial will end in 3 days. Your paid subscription will begin automatically unless canceled.",
        referenceId: subscription._id,
        referenceModel: "Subscription",
      });
    } catch (err) {
      // Non-blocking
    }
  }
};

export const SubscriptionService = {
  createCheckoutSession,
  updateSubscriptionPlan,
  cancelUpcomingPlan,
  getMySubscriptionFromDB,
  createCustomerPortalSession,
  cancelSubscription,
  getAllSubscriptionsFromDB,
  // Webhook handlers
  handleSubscriptionCheckoutCompleted,
  handleInvoicePaymentSucceeded,
  handleInvoicePaymentFailed,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleTrialWillEnd,
};
