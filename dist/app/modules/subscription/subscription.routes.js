"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionRoutes = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const user_1 = require("../../../enums/user");
const subscription_controller_1 = require("./subscription.controller");
const subscription_validation_1 = require("./subscription.validation");
const admin_controller_1 = require("../admin/admin.controller");
const router = express_1.default.Router();
/**
 * 1. Create Checkout Session for purchasing a subscription plan
 * Role: Professional only
 */
router.post("/checkout-session", (0, auth_1.default)(user_1.USER_ROLES.PROFESSIONAL), (0, validateRequest_1.default)(subscription_validation_1.SubscriptionValidation.createCheckoutSessionZodSchema), subscription_controller_1.SubscriptionController.createCheckoutSession);
/**
 * 2. Update / Switch Plan (Monthly -> Yearly or change package)
 * Starts after current plan period ends
 * Role: Professional only
 */
router.post("/update-plan", (0, auth_1.default)(user_1.USER_ROLES.PROFESSIONAL), (0, validateRequest_1.default)(subscription_validation_1.SubscriptionValidation.updateSubscriptionPlanZodSchema), subscription_controller_1.SubscriptionController.updateSubscriptionPlan);
/**
 * 3. Cancel scheduled upcoming plan change
 * Role: Professional only
 */
router.delete("/cancel-upcoming-plan", (0, auth_1.default)(user_1.USER_ROLES.PROFESSIONAL), subscription_controller_1.SubscriptionController.cancelUpcomingPlan);
/**
 * 4. Get Current User's active subscription and limits
 * Role: Professional (or Admin viewing)
 */
router.get("/my-subscription", (0, auth_1.default)(user_1.USER_ROLES.PROFESSIONAL, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), subscription_controller_1.SubscriptionController.getMySubscription);
/**
 * 5. Stripe Customer Portal Session for billing self-service
 * Role: Professional only
 */
router.post("/customer-portal", (0, auth_1.default)(user_1.USER_ROLES.PROFESSIONAL), subscription_controller_1.SubscriptionController.createCustomerPortalSession);
/**
 * 6. Cancel Subscription
 * Role: Professional only
 */
router.delete("/cancel", (0, auth_1.default)(user_1.USER_ROLES.PROFESSIONAL), subscription_controller_1.SubscriptionController.cancelSubscription);
/**
 * 7. Get All Subscriptions (Admin Dashboard)
 * Role: Admin, Super Admin
 */
router.get("/", (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), subscription_controller_1.SubscriptionController.getAllSubscriptions);
/**
 * 8. Transactions List (Subscription Billing Screen)
 * Role: Admin, Super Admin
 */
router.get("/transactions", (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), admin_controller_1.AdminController.getTransactions);
/**
 * 9. Single Transaction Details (Modal)
 * Role: Admin, Super Admin
 */
router.get("/transactions/:id", (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), admin_controller_1.AdminController.getTransactionById);
/**
 * 10. Refund Transaction
 * Role: Admin, Super Admin
 */
router.post("/transactions/:id/refund", (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), admin_controller_1.AdminController.refundTransaction);
exports.SubscriptionRoutes = router;
