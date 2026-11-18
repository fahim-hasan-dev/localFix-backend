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
exports.verifyQuotationSubscriptionGuard = exports.getSubscriptionQuotationUsage = void 0;
const mongoose_1 = require("mongoose");
const http_status_codes_1 = require("http-status-codes");
const ApiErrors_1 = __importDefault(require("../../../errors/ApiErrors"));
const subscription_model_1 = require("./subscription.model");
const quotation_model_1 = require("../quotation/quotation.model");
/**
 * Calculates current quotation subscription status, quotas, and usage for a professional.
 * Highly reusable across services, controllers, and middlewares.
 */
const getSubscriptionQuotationUsage = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    const proObjectId = typeof userId === "string" ? new mongoose_1.Types.ObjectId(userId) : userId;
    let subscription = yield subscription_model_1.Subscription.findOne({
        userId: proObjectId,
        isDeleted: { $ne: true },
        status: { $in: ["active", "trialing", "past_due"] },
    })
        .populate("packageId")
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
            rejectionReason: "You do not have an active subscription or free trial. Please subscribe to a package to send quotations.",
            errorCode: "NO_ACTIVE_SUBSCRIPTION",
        };
    }
    const now = new Date();
    // Auto-apply upcoming scheduled plan if effectiveDate has passed
    if (subscription.upcomingPlan &&
        subscription.upcomingPlan.status === "scheduled" &&
        now >= new Date(subscription.upcomingPlan.effectiveDate)) {
        subscription.packageId = subscription.upcomingPlan.packageId;
        subscription.planType = subscription.upcomingPlan.planType;
        subscription.currentPeriodStart = subscription.upcomingPlan.effectiveDate;
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
        yield subscription.populate("packageId");
    }
    // Check trial expiration
    const isTrial = Boolean(subscription.status === "trialing" || subscription.isTrial);
    const trialExpired = Boolean(isTrial &&
        subscription.trialEndsAt &&
        now > new Date(subscription.trialEndsAt));
    if (trialExpired) {
        return {
            hasActiveSubscription: false,
            canSendQuotation: false,
            subscription,
            package: subscription.packageId,
            leadLimit: (_b = (_a = subscription.packageId) === null || _a === void 0 ? void 0 : _a.leadLimit) !== null && _b !== void 0 ? _b : 0,
            usedQuotations: 0,
            remainingQuotations: 0,
            isUnlimited: false,
            isTrial: true,
            trialExpired: true,
            isExpired: true,
            periodStart: subscription.currentPeriodStart,
            periodEnd: subscription.currentPeriodEnd,
            rejectionReason: "Your free trial period has ended. Please subscribe to a paid package to continue sending quotations.",
            errorCode: "TRIAL_EXPIRED",
        };
    }
    // Check past_due / unpaid status
    if (subscription.status === "past_due" || subscription.status === "unpaid") {
        return {
            hasActiveSubscription: false,
            canSendQuotation: false,
            subscription,
            package: subscription.packageId,
            leadLimit: (_d = (_c = subscription.packageId) === null || _c === void 0 ? void 0 : _c.leadLimit) !== null && _d !== void 0 ? _d : 0,
            usedQuotations: 0,
            remainingQuotations: 0,
            isUnlimited: false,
            isTrial,
            trialExpired: false,
            isExpired: false,
            periodStart: subscription.currentPeriodStart,
            periodEnd: subscription.currentPeriodEnd,
            rejectionReason: "Your subscription payment is past due. Please update your billing method to send quotations.",
            errorCode: "SUBSCRIPTION_PAST_DUE",
        };
    }
    // Check period expiration
    const periodEnd = subscription.currentPeriodEnd
        ? new Date(subscription.currentPeriodEnd)
        : null;
    const isExpired = Boolean(periodEnd && now > periodEnd && subscription.status !== "active");
    if (isExpired) {
        return {
            hasActiveSubscription: false,
            canSendQuotation: false,
            subscription,
            package: subscription.packageId,
            leadLimit: (_f = (_e = subscription.packageId) === null || _e === void 0 ? void 0 : _e.leadLimit) !== null && _f !== void 0 ? _f : 0,
            usedQuotations: 0,
            remainingQuotations: 0,
            isUnlimited: false,
            isTrial,
            trialExpired: false,
            isExpired: true,
            periodStart: subscription.currentPeriodStart,
            periodEnd,
            rejectionReason: "Your subscription period has ended. Please renew or upgrade your plan to send quotations.",
            errorCode: "SUBSCRIPTION_EXPIRED",
        };
    }
    // Verify associated package
    const pkg = subscription.packageId;
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
            rejectionReason: "The subscription package associated with your account is inactive or not found.",
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
    const usedQuotations = yield quotation_model_1.Quotation.countDocuments({
        professional: proObjectId,
        createdAt: Object.assign({ $gte: periodStart }, (periodEnd ? { $lte: periodEnd } : {})),
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
});
exports.getSubscriptionQuotationUsage = getSubscriptionQuotationUsage;
/**
 * Guard function to assert that a professional is eligible to submit a quotation.
 * Throws ApiError if ineligible.
 */
const verifyQuotationSubscriptionGuard = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const usage = yield (0, exports.getSubscriptionQuotationUsage)(userId);
    if (!usage.hasActiveSubscription) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.PAYMENT_REQUIRED, usage.rejectionReason ||
            "You do not have an active subscription or free trial. Please subscribe to a package.", usage.errorCode || "SUBSCRIPTION_REQUIRED");
    }
    if (!usage.canSendQuotation) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, usage.rejectionReason ||
            "You have reached your quotation limit for this billing period.", usage.errorCode || "QUOTATION_LIMIT_REACHED");
    }
    return usage;
});
exports.verifyQuotationSubscriptionGuard = verifyQuotationSubscriptionGuard;
