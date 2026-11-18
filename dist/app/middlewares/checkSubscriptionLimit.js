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
exports.verifyQuotationSubscriptionGuard = exports.getSubscriptionQuotationUsage = exports.checkFlatLimit = exports.checkPropertyLimit = exports.checkSubscriptionLimit = exports.checkQuotationLimit = exports.verifyActiveSubscription = void 0;
const http_status_codes_1 = require("http-status-codes");
const ApiErrors_1 = __importDefault(require("../../errors/ApiErrors"));
const user_1 = require("../../enums/user");
const subscription_helper_1 = require("../modules/subscription/subscription.helper");
Object.defineProperty(exports, "getSubscriptionQuotationUsage", { enumerable: true, get: function () { return subscription_helper_1.getSubscriptionQuotationUsage; } });
Object.defineProperty(exports, "verifyQuotationSubscriptionGuard", { enumerable: true, get: function () { return subscription_helper_1.verifyQuotationSubscriptionGuard; } });
const subscription_model_1 = require("../modules/subscription/subscription.model");
/**
 * Generic validator for any active subscription / trial.
 */
const verifyActiveSubscription = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const subscription = yield subscription_model_1.Subscription.findOne({
        userId,
        status: { $in: ["active", "trialing"] },
        isDeleted: { $ne: true },
    }).populate("packageId");
    if (!subscription) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.PAYMENT_REQUIRED, "You do not have an active subscription or free trial. Please subscribe to a plan.", "NO_ACTIVE_SUBSCRIPTION");
    }
    if (subscription.status === "trialing" &&
        subscription.trialEndsAt &&
        new Date() > new Date(subscription.trialEndsAt)) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.PAYMENT_REQUIRED, "Your free trial period has ended. Please upgrade your subscription.", "TRIAL_EXPIRED");
    }
    if (!subscription.packageId) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, "Associated subscription package could not be found", "PACKAGE_NOT_FOUND");
    }
    return subscription;
});
exports.verifyActiveSubscription = verifyActiveSubscription;
/**
 * Middleware: Guards quotation creation based on the professional's subscription package and lead quota.
 * Admin and Super Admin roles bypass this check.
 */
const checkQuotationLimit = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = req.user;
        // Allow admins / super admins to bypass subscription limits
        if ((user === null || user === void 0 ? void 0 : user.role) === user_1.USER_ROLES.ADMIN ||
            (user === null || user === void 0 ? void 0 : user.role) === user_1.USER_ROLES.SUPER_ADMIN) {
            return next();
        }
        const usage = yield (0, subscription_helper_1.verifyQuotationSubscriptionGuard)(user.id);
        // Attach quota status to request for downstream handlers if needed
        req.subscriptionQuota = usage;
        next();
    }
    catch (error) {
        next(error);
    }
});
exports.checkQuotationLimit = checkQuotationLimit;
// Aliases for compatibility and reusable naming
exports.checkSubscriptionLimit = exports.checkQuotationLimit;
exports.checkPropertyLimit = exports.checkQuotationLimit;
exports.checkFlatLimit = exports.checkQuotationLimit;
