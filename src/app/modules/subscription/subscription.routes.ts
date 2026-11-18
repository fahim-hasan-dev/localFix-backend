import express from "express";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { USER_ROLES } from "../../../enums/user";
import { SubscriptionController } from "./subscription.controller";
import { SubscriptionValidation } from "./subscription.validation";
import { AdminController } from "../admin/admin.controller";

const router = express.Router();

/**
 * 1. Create Checkout Session for purchasing a subscription plan
 * Role: Professional only
 */
router.post(
  "/checkout-session",
  auth(USER_ROLES.PROFESSIONAL),
  validateRequest(SubscriptionValidation.createCheckoutSessionZodSchema),
  SubscriptionController.createCheckoutSession,
);

/**
 * 2. Update / Switch Plan (Monthly -> Yearly or change package)
 * Starts after current plan period ends
 * Role: Professional only
 */
router.post(
  "/update-plan",
  auth(USER_ROLES.PROFESSIONAL),
  validateRequest(SubscriptionValidation.updateSubscriptionPlanZodSchema),
  SubscriptionController.updateSubscriptionPlan,
);

/**
 * 3. Cancel scheduled upcoming plan change
 * Role: Professional only
 */
router.delete(
  "/cancel-upcoming-plan",
  auth(USER_ROLES.PROFESSIONAL),
  SubscriptionController.cancelUpcomingPlan,
);

/**
 * 4. Get Current User's active subscription and limits
 * Role: Professional (or Admin viewing)
 */
router.get(
  "/my-subscription",
  auth(USER_ROLES.PROFESSIONAL, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  SubscriptionController.getMySubscription,
);

/**
 * 5. Stripe Customer Portal Session for billing self-service
 * Role: Professional only
 */
router.post(
  "/customer-portal",
  auth(USER_ROLES.PROFESSIONAL),
  SubscriptionController.createCustomerPortalSession,
);

/**
 * 6. Cancel Subscription
 * Role: Professional only
 */
router.delete(
  "/cancel",
  auth(USER_ROLES.PROFESSIONAL),
  SubscriptionController.cancelSubscription,
);

/**
 * 7. Get All Subscriptions (Admin Dashboard)
 * Role: Admin, Super Admin
 */
router.get(
  "/",
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  SubscriptionController.getAllSubscriptions,
);

/**
 * 8. Transactions List (Subscription Billing Screen)
 * Role: Admin, Super Admin
 */
router.get(
  "/transactions",
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  AdminController.getTransactions,
);

/**
 * 9. Single Transaction Details (Modal)
 * Role: Admin, Super Admin
 */
router.get(
  "/transactions/:id",
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  AdminController.getTransactionById,
);

/**
 * 10. Refund Transaction
 * Role: Admin, Super Admin
 */
router.post(
  "/transactions/:id/refund",
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  AdminController.refundTransaction,
);

export const SubscriptionRoutes = router;
