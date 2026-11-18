"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionService = void 0;
const http_status_codes_1 = require("http-status-codes");
const config_1 = __importDefault(require("../../../config"));
const ApiErrors_1 = __importDefault(require("../../../errors/ApiErrors"));
const stripeHelper_1 = require("../../../helpers/stripeHelper");
const currencyHelper_1 = require("../../../helpers/currencyHelper");
const notificationsHelper_1 = require("../../../helpers/notificationsHelper");
const user_1 = require("../../../enums/user");
const notification_constant_1 = require("../notification/notification.constant");
const package_model_1 = require("../package/package.model");
const user_model_1 = require("../user/user.model");
const subscription_model_1 = require("./subscription.model");
const subscription_helper_1 = require("./subscription.helper");
/**
 * Helper to ensure a Stripe Price exists for a Package and billingCycle/planType
 */
const getOrCreateStripePrice = (stripe, pkg, planType) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    // Check if appropriate price ID already exists on the package
    let priceId = planType === "yearly" ? pkg.stripeYearlyPriceId : pkg.stripeMonthlyPriceId;
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
        const prod = yield stripe.products.create({
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
            (_a = pkg.yearlyPrice) !== null && _a !== void 0 ? _a : (pkg.billingCycle === "yearly" ? pkg.price : (pkg.price || 0) * 10);
    }
    else {
        priceAmount =
            (_b = pkg.monthlyPrice) !== null && _b !== void 0 ? _b : (pkg.billingCycle === "monthly" ? pkg.price : (pkg.price || 0));
    }
    const currency = (0, currencyHelper_1.getCurrencyCode)();
    const newPrice = yield stripe.prices.create({
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
    }
    else {
        pkg.stripeMonthlyPriceId = newPrice.id;
    }
    if (!pkg.stripePriceId || pkg.billingCycle === planType) {
        pkg.stripePriceId = newPrice.id;
    }
    yield pkg.save();
    return newPrice.id;
});
// ==========================================
// 1. Create Checkout Session for Purchase
// ==========================================
const createCheckoutSession = (userId, packageId, planType) => __awaiter(void 0, void 0, void 0, function* () {
    const stripe = (0, stripeHelper_1.getStripe)();
    const user = yield user_model_1.User.findById(userId);
    if (!user) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "User not found");
    }
    // Only users with professional role can purchase subscriptions
    if (user.role !== user_1.USER_ROLES.PROFESSIONAL) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "Only professionals can purchase a subscription plan");
    }
    const selectedPackage = yield package_model_1.Package.findById(packageId);
    if (!selectedPackage || !selectedPackage.isActive) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Selected package not found or inactive");
    }
    // Check if user already has an active or trialing subscription
    const existingActiveSubscription = yield subscription_model_1.Subscription.findOne({
        userId,
        status: { $in: ["active", "trialing"] },
    }).populate("packageId");
    if (existingActiveSubscription) {
        const currentPkg = existingActiveSubscription.packageId;
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `You already have an active subscription (${(currentPkg === null || currentPkg === void 0 ? void 0 : currentPkg.name) || "Current Plan"}). To upgrade or switch your plan starting after your current period ends, please use the update-plan endpoint.`);
    }
    const priceId = yield getOrCreateStripePrice(stripe, selectedPackage, planType);
    // Find or Create Stripe Customer
    let stripeCustomerId;
    const previousSub = yield subscription_model_1.Subscription.findOne({ userId }).sort({
        createdAt: -1,
    });
    if (previousSub === null || previousSub === void 0 ? void 0 : previousSub.stripeCustomerId) {
        stripeCustomerId = previousSub.stripeCustomerId;
    }
    else {
        const customer = yield stripe.customers.create({
            email: user.email,
            name: user.name,
            metadata: {
                userId: user._id.toString(),
                role: user.role,
            },
        });
        stripeCustomerId = customer.id;
    }
    // Prevent multiple free trials for the same user
    const hadPreviousTrial = yield subscription_model_1.Subscription.findOne({
        userId,
        isTrial: true,
    });
    const shouldApplyTrial = selectedPackage.hasTrial &&
        selectedPackage.trialDays > 0 &&
        !hadPreviousTrial;
    const clientUrl = config_1.default.client_url || "http://localhost:3000";
    const sessionParams = {
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
        subscription_data: Object.assign({ metadata: {
                paymentType: "subscription",
                userId: user._id.toString(),
                packageId: selectedPackage._id.toString(),
                planType,
            } }, (shouldApplyTrial
            ? { trial_period_days: selectedPackage.trialDays }
            : {})),
    };
    const session = yield stripe.checkout.sessions.create(sessionParams);
    return {
        checkoutUrl: session.url,
        sessionId: session.id,
    };
});
// ==========================================
// 2. Update / Switch Subscription Plan
// (Starts after current plan period ends)
// ==========================================
const updateSubscriptionPlan = (userId, newPackageId, newPlanType) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
    const stripe = (0, stripeHelper_1.getStripe)();
    const user = yield user_model_1.User.findById(userId);
    if (!user) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "User not found");
    }
    if (user.role !== user_1.USER_ROLES.PROFESSIONAL) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "Only professionals can manage subscription plans");
    }
    const currentSub = yield subscription_model_1.Subscription.findOne({
        userId,
        status: { $in: ["active", "trialing"] },
    }).populate("packageId");
    if (!currentSub) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "No active subscription found to update. Please purchase a plan first.");
    }
    const newPackage = yield package_model_1.Package.findById(newPackageId);
    if (!newPackage || !newPackage.isActive) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Target package not found or inactive");
    }
    const currentPkg = currentSub.packageId;
    const currentPkgId = ((_a = currentPkg === null || currentPkg === void 0 ? void 0 : currentPkg._id) === null || _a === void 0 ? void 0 : _a.toString()) || ((_b = currentSub.packageId) === null || _b === void 0 ? void 0 : _b.toString());
    // If selecting the exact same package and billing cycle
    if (currentPkgId === newPackageId && currentSub.planType === newPlanType) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `You are already subscribed to the ${newPackage.name} (${newPlanType}) plan.`);
    }
    // Ensure Stripe price for the target package and planType exists
    const newPriceId = yield getOrCreateStripePrice(stripe, newPackage, newPlanType);
    // Requirement: The new plan starts after the current plan period ends
    const effectiveDate = currentSub.currentPeriodEnd;
    // In Stripe: Schedule the phase transition at current_period_end
    try {
        const stripeSub = yield stripe.subscriptions.retrieve(currentSub.stripeSubscriptionId);
        let scheduleId = stripeSub.schedule;
        if (!scheduleId) {
            const schedule = yield stripe.subscriptionSchedules.create({
                from_subscription: stripeSub.id,
            });
            scheduleId = schedule.id;
        }
        const schedule = yield stripe.subscriptionSchedules.retrieve(scheduleId);
        const currentPhase = schedule.phases[0];
        const phaseStart = (currentPhase === null || currentPhase === void 0 ? void 0 : currentPhase.start_date) ||
            Math.floor(currentSub.currentPeriodStart.getTime() / 1000);
        const phaseEnd = (currentPhase === null || currentPhase === void 0 ? void 0 : currentPhase.end_date) ||
            Math.floor(currentSub.currentPeriodEnd.getTime() / 1000);
        const currentPriceId = ((_d = (_c = currentPhase === null || currentPhase === void 0 ? void 0 : currentPhase.items) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.price) ||
            ((_e = stripeSub.items.data[0]) === null || _e === void 0 ? void 0 : _e.price.id);
        yield stripe.subscriptionSchedules.update(scheduleId, {
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
    }
    catch (stripeErr) {
        // If Stripe schedule update is restricted, gracefully fallback to DB scheduling
        // and subscription metadata update
        try {
            yield stripe.subscriptions.update(currentSub.stripeSubscriptionId, {
                metadata: {
                    upcomingPackageId: newPackage._id.toString(),
                    upcomingPlanType: newPlanType,
                    upcomingPriceId: newPriceId,
                },
            });
        }
        catch (ignore) {
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
    yield currentSub.save();
    yield currentSub.populate(["packageId", "upcomingPlan.packageId"]);
    // Send in-app / push notification
    try {
        yield (0, notificationsHelper_1.sendNotifications)({
            receiver: user._id,
            type: notification_constant_1.NOTIFICATION_TYPE.PROFESSIONAL,
            title: "Plan Update Scheduled",
            text: `Your plan will automatically update to ${newPackage.name} (${newPlanType}) on ${effectiveDate.toLocaleDateString()} after your current plan period ends.`,
            referenceId: currentSub._id,
            referenceModel: "Subscription",
        });
    }
    catch (notifErr) {
        // Notification failure shouldn't fail the update API
    }
    return {
        message: `Plan update scheduled successfully. Your new ${newPackage.name} (${newPlanType}) plan will start on ${effectiveDate.toISOString()} after the current period ends.`,
        subscription: currentSub,
        effectiveDate,
    };
});
// ==========================================
// 3. Cancel Scheduled Upcoming Plan Change
// ==========================================
const cancelUpcomingPlan = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const stripe = (0, stripeHelper_1.getStripe)();
    const currentSub = yield subscription_model_1.Subscription.findOne({
        userId,
        status: { $in: ["active", "trialing"] },
    }).populate("packageId");
    if (!currentSub || !currentSub.upcomingPlan) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "No upcoming plan change scheduled to cancel");
    }
    try {
        const stripeSub = yield stripe.subscriptions.retrieve(currentSub.stripeSubscriptionId);
        if (stripeSub.schedule) {
            // Release subscription from schedule so it stays on current plan
            yield stripe.subscriptionSchedules.release(stripeSub.schedule);
        }
    }
    catch (err) {
        // Ignore if already released
    }
    currentSub.upcomingPlan = undefined;
    yield currentSub.save();
    return {
        message: "Scheduled upcoming plan change has been successfully canceled.",
        subscription: currentSub,
    };
});
// ==========================================
// 4. Get Current Professional's Subscription
// ==========================================
const getMySubscriptionFromDB = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    let subscription = yield subscription_model_1.Subscription.findOne({
        userId,
        status: { $in: ["active", "trialing", "past_due"] },
    })
        .populate("packageId")
        .populate("upcomingPlan.packageId")
        .sort({ createdAt: -1 });
    if (!subscription) {
        // Check if there was any previous canceled or expired subscription
        const latestPastSub = yield subscription_model_1.Subscription.findOne({ userId })
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
    if (subscription.upcomingPlan &&
        subscription.upcomingPlan.status === "scheduled" &&
        new Date() >= new Date(subscription.upcomingPlan.effectiveDate)) {
        subscription.packageId = subscription.upcomingPlan.packageId;
        subscription.planType = subscription.upcomingPlan.planType;
        subscription.currentPeriodStart = subscription.upcomingPlan.effectiveDate;
        // Calculate new currentPeriodEnd based on planType
        const newEnd = new Date(subscription.currentPeriodStart);
        if (subscription.planType === "yearly") {
            newEnd.setFullYear(newEnd.getFullYear() + 1);
        }
        else {
            newEnd.setMonth(newEnd.getMonth() + 1);
        }
        subscription.currentPeriodEnd = newEnd;
        subscription.upcomingPlan.status = "applied";
        yield subscription.save();
        yield subscription.populate(["packageId", "upcomingPlan.packageId"]);
    }
    const pkg = subscription.packageId;
    const now = new Date();
    const currentPeriodEnd = new Date(subscription.currentPeriodEnd);
    const diffMs = currentPeriodEnd.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    const isExpired = diffMs <= 0;
    let upcomingPlanInfo = null;
    if (subscription.upcomingPlan &&
        subscription.upcomingPlan.status === "scheduled") {
        const upPkg = subscription.upcomingPlan.packageId;
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
    const quotationUsage = yield (0, subscription_helper_1.getSubscriptionQuotationUsage)(userId);
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
});
// ==========================================
// 5. Customer Portal Session (Self-service)
// ==========================================
const createCustomerPortalSession = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const stripe = (0, stripeHelper_1.getStripe)();
    const subscription = yield subscription_model_1.Subscription.findOne({ userId }).sort({
        createdAt: -1,
    });
    if (!subscription || !subscription.stripeCustomerId) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "No active Stripe customer found for this account");
    }
    const clientUrl = config_1.default.client_url || "http://localhost:3000";
    const portalSession = yield stripe.billingPortal.sessions.create({
        customer: subscription.stripeCustomerId,
        return_url: `${clientUrl}/dashboard`,
    });
    return {
        url: portalSession.url,
    };
});
// ==========================================
// 6. Cancel Subscription
// ==========================================
const cancelSubscription = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const stripe = (0, stripeHelper_1.getStripe)();
    const subscription = yield subscription_model_1.Subscription.findOne({
        userId,
        status: { $in: ["active", "trialing"] },
    }).populate("packageId");
    if (!subscription) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "No active subscription found to cancel");
    }
    // Cancel immediately on Stripe
    try {
        yield stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
    }
    catch (err) {
        // If already canceled on Stripe or error in test mode, continue
    }
    subscription.status = "canceled";
    subscription.canceledAt = new Date();
    subscription.cancelAtPeriodEnd = false;
    if (subscription.upcomingPlan) {
        subscription.upcomingPlan = undefined;
    }
    yield subscription.save();
    // Send cancellation notification
    try {
        const pkg = subscription.packageId;
        yield (0, notificationsHelper_1.sendNotifications)({
            receiver: subscription.userId,
            type: notification_constant_1.NOTIFICATION_TYPE.PROFESSIONAL,
            title: "Subscription Canceled",
            text: `Your ${(pkg === null || pkg === void 0 ? void 0 : pkg.name) || "LocalFix"} subscription has been canceled.`,
            referenceId: subscription._id,
            referenceModel: "Subscription",
        });
    }
    catch (notifErr) {
        // Non-blocking
    }
    return { message: "Subscription canceled successfully", subscription };
});
// ==========================================
// 7. Get All Subscriptions (Admin only)
// ==========================================
const getAllSubscriptionsFromDB = (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (query = {}) {
    const filter = {
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
    const result = yield subscription_model_1.Subscription.find(filter)
        .populate("userId", "name email phone role companyName")
        .populate("packageId")
        .populate("upcomingPlan.packageId")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
    const total = yield subscription_model_1.Subscription.countDocuments(filter);
    return {
        meta: {
            page,
            limit,
            total,
            totalPage: Math.ceil(total / limit),
        },
        data: result,
    };
});
// ==========================================
// 🛡️ WEBHOOK EVENT HANDLERS (100% Secure)
// ==========================================
// A. Handle checkout.session.completed for subscription purchase
const handleSubscriptionCheckoutCompleted = (session) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    if (session.mode !== "subscription" || !session.subscription) {
        return;
    }
    const stripe = (0, stripeHelper_1.getStripe)();
    const stripeSubscription = yield stripe.subscriptions.retrieve(session.subscription);
    const userId = ((_a = session.metadata) === null || _a === void 0 ? void 0 : _a.userId) || ((_b = stripeSubscription.metadata) === null || _b === void 0 ? void 0 : _b.userId);
    const packageId = ((_c = session.metadata) === null || _c === void 0 ? void 0 : _c.packageId) || ((_d = stripeSubscription.metadata) === null || _d === void 0 ? void 0 : _d.packageId);
    const planType = (((_e = session.metadata) === null || _e === void 0 ? void 0 : _e.planType) ||
        ((_f = stripeSubscription.metadata) === null || _f === void 0 ? void 0 : _f.planType) ||
        "monthly");
    if (!userId || !packageId) {
        return;
    }
    const subObj = stripeSubscription;
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
    const savedSub = yield subscription_model_1.Subscription.findOneAndUpdate({ stripeSubscriptionId: subObj.id }, {
        userId,
        packageId,
        stripeCustomerId: session.customer,
        stripeSubscriptionId: subObj.id,
        planType,
        status: subObj.status,
        isTrial,
        trialStartsAt,
        trialEndsAt,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: subObj.cancel_at_period_end || false,
    }, { upsert: true, new: true }).populate("packageId");
    // Send Push / In-App Notification to Professional
    try {
        const pkg = savedSub === null || savedSub === void 0 ? void 0 : savedSub.packageId;
        yield (0, notificationsHelper_1.sendNotifications)({
            receiver: userId,
            type: notification_constant_1.NOTIFICATION_TYPE.PROFESSIONAL,
            title: "Subscription Activated",
            text: `Your ${(pkg === null || pkg === void 0 ? void 0 : pkg.name) || "LocalFix"} (${planType}) subscription is now active!`,
            referenceId: savedSub === null || savedSub === void 0 ? void 0 : savedSub._id,
            referenceModel: "Subscription",
        });
    }
    catch (err) {
        // Non-blocking notification
    }
});
// B. Handle invoice.payment_succeeded (recurring renewal or trial conversion to paid)
const handleInvoicePaymentSucceeded = (invoice) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const inv = invoice;
    const subscriptionId = inv.subscription ||
        ((_b = (_a = inv.parent) === null || _a === void 0 ? void 0 : _a.subscription_details) === null || _b === void 0 ? void 0 : _b.subscription) ||
        ((_e = (_d = (_c = inv.lines) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.subscription);
    if (!subscriptionId)
        return;
    const stripe = (0, stripeHelper_1.getStripe)();
    const stripeSubscription = yield stripe.subscriptions.retrieve(subscriptionId);
    const subObj = stripeSubscription;
    const subscription = yield subscription_model_1.Subscription.findOne({
        stripeSubscriptionId: subObj.id,
    }).populate(["packageId", "upcomingPlan.packageId"]);
    if (subscription) {
        subscription.status = subObj.status;
        if (subObj.current_period_start) {
            subscription.currentPeriodStart = new Date(subObj.current_period_start * 1000);
        }
        if (subObj.current_period_end) {
            subscription.currentPeriodEnd = new Date(subObj.current_period_end * 1000);
        }
        subscription.latestInvoiceId = inv.id;
        subscription.cancelAtPeriodEnd = subObj.cancel_at_period_end || false;
        // If there was an upcoming scheduled plan transition, check if this invoice corresponds to it
        if (subscription.upcomingPlan &&
            subscription.upcomingPlan.status === "scheduled") {
            const activePriceId = (_j = (_h = (_g = (_f = subObj.items) === null || _f === void 0 ? void 0 : _f.data) === null || _g === void 0 ? void 0 : _g[0]) === null || _h === void 0 ? void 0 : _h.price) === null || _j === void 0 ? void 0 : _j.id;
            if (!subscription.upcomingPlan.stripePriceId ||
                activePriceId === subscription.upcomingPlan.stripePriceId ||
                new Date() >= new Date(subscription.upcomingPlan.effectiveDate)) {
                subscription.packageId = subscription.upcomingPlan.packageId;
                subscription.planType = subscription.upcomingPlan.planType;
                subscription.upcomingPlan.status = "applied";
            }
        }
        // Check if it was trial
        const wasTrial = subscription.isTrial;
        if (subscription.isTrial && subObj.status === "active") {
            subscription.isTrial = false;
        }
        yield subscription.save();
        // Do NOT send renewed notification on initial checkout
        if (inv.billing_reason === "subscription_create") {
            return;
        }
        // Send renewal notification
        try {
            const pkg = subscription.packageId;
            yield (0, notificationsHelper_1.sendNotifications)({
                receiver: subscription.userId,
                type: notification_constant_1.NOTIFICATION_TYPE.PROFESSIONAL,
                title: "Subscription Renewed",
                text: `Your ${(pkg === null || pkg === void 0 ? void 0 : pkg.name) || "LocalFix"} subscription has been successfully renewed until ${subscription.currentPeriodEnd.toLocaleDateString()}.`,
                referenceId: subscription._id,
                referenceModel: "Subscription",
            });
        }
        catch (err) {
            // Non-blocking
        }
    }
});
// C. Handle invoice.payment_failed
const handleInvoicePaymentFailed = (invoice) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
    const inv = invoice;
    const subscriptionId = inv.subscription ||
        ((_b = (_a = inv.parent) === null || _a === void 0 ? void 0 : _a.subscription_details) === null || _b === void 0 ? void 0 : _b.subscription) ||
        ((_e = (_d = (_c = inv.lines) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.subscription);
    if (!subscriptionId)
        return;
    const subscription = yield subscription_model_1.Subscription.findOne({
        stripeSubscriptionId: subscriptionId,
    });
    if (subscription) {
        subscription.status = "past_due";
        yield subscription.save();
        // Notify user about payment failure
        try {
            yield (0, notificationsHelper_1.sendNotifications)({
                receiver: subscription.userId,
                type: notification_constant_1.NOTIFICATION_TYPE.PROFESSIONAL,
                title: "Subscription Payment Failed",
                text: "Your subscription renewal payment failed. Please update your payment method to keep your professional subscription active.",
                referenceId: subscription._id,
                referenceModel: "Subscription",
            });
        }
        catch (err) {
            // Non-blocking
        }
    }
});
// D. Handle customer.subscription.updated (Plan changes, schedule transitions, cancellations)
const handleSubscriptionUpdated = (stripeSubscription) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    const subObj = stripeSubscription;
    const subscription = yield subscription_model_1.Subscription.findOne({
        stripeSubscriptionId: subObj.id,
    }).populate(["packageId", "upcomingPlan.packageId"]);
    if (subscription) {
        subscription.status = subObj.status;
        subscription.cancelAtPeriodEnd = subObj.cancel_at_period_end || false;
        if (subObj.current_period_start) {
            subscription.currentPeriodStart = new Date(subObj.current_period_start * 1000);
        }
        if (subObj.current_period_end) {
            subscription.currentPeriodEnd = new Date(subObj.current_period_end * 1000);
        }
        if (subObj.status === "canceled") {
            subscription.canceledAt = new Date();
        }
        // Check if Stripe updated price (e.g., transition occurred)
        const activePriceId = (_d = (_c = (_b = (_a = subObj.items) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.price) === null || _d === void 0 ? void 0 : _d.id;
        if (activePriceId) {
            if (subscription.upcomingPlan &&
                subscription.upcomingPlan.status === "scheduled" &&
                activePriceId === subscription.upcomingPlan.stripePriceId) {
                subscription.packageId = subscription.upcomingPlan.packageId;
                subscription.planType = subscription.upcomingPlan.planType;
                subscription.upcomingPlan.status = "applied";
            }
            else {
                // Attempt to find package corresponding to new price
                const matchedPkg = yield package_model_1.Package.findOne({
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
                    }
                    else if (matchedPkg.stripeMonthlyPriceId === activePriceId) {
                        subscription.planType = "monthly";
                    }
                }
            }
        }
        yield subscription.save();
    }
});
// E. Handle customer.subscription.deleted (Plan terminated)
const handleSubscriptionDeleted = (stripeSubscription) => __awaiter(void 0, void 0, void 0, function* () {
    const subObj = stripeSubscription;
    const subscription = yield subscription_model_1.Subscription.findOne({
        stripeSubscriptionId: subObj.id,
    });
    if (subscription) {
        subscription.status = "canceled";
        subscription.canceledAt = new Date();
        yield subscription.save();
        try {
            yield (0, notificationsHelper_1.sendNotifications)({
                receiver: subscription.userId,
                type: notification_constant_1.NOTIFICATION_TYPE.PROFESSIONAL,
                title: "Subscription Canceled",
                text: "Your subscription has been canceled.",
                referenceId: subscription._id,
                referenceModel: "Subscription",
            });
        }
        catch (err) {
            // Non-blocking
        }
    }
});
// F. Handle customer.subscription.trial_will_end (3 days before trial ends)
const handleTrialWillEnd = (stripeSubscription) => __awaiter(void 0, void 0, void 0, function* () {
    const subscription = yield subscription_model_1.Subscription.findOne({
        stripeSubscriptionId: stripeSubscription.id,
    });
    if (subscription && subscription.userId) {
        try {
            yield (0, notificationsHelper_1.sendNotifications)({
                receiver: subscription.userId,
                type: notification_constant_1.NOTIFICATION_TYPE.PROFESSIONAL,
                title: "Free Trial Ending Soon",
                text: "Your free trial will end in 3 days. Your paid subscription will begin automatically unless canceled.",
                referenceId: subscription._id,
                referenceModel: "Subscription",
            });
        }
        catch (err) {
            // Non-blocking
        }
    }
});
exports.SubscriptionService = {
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
