import express from "express";
import auth from "../../middlewares/auth";
import { USER_ROLES } from "../../../enums/user";
import { AdminController } from "./admin.controller";

const router = express.Router();

// Admin Dashboard Summary Cards (Stats)
router.get(
  "/stats",
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  AdminController.getAdminDashboardData,
);

// Revenue Over Time (Platform revenue overview)
router.get(
  "/revenue",
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  AdminController.getMonthlyRevenue,
);

// User Growth (Cumulative registrations: Homeowners & Verified Pros)
router.get(
  "/user-growth",
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  AdminController.getUserGrowth,
);

// Transaction Summary Cards (Paying Pros, Transactions, Total Collected)
router.get(
  "/transactions/stats",
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  AdminController.getTransactionStats,
);

// Transactions List (Table with search, plan tier, status tabs, date filter, pagination, CSV export)
router.get(
  "/transactions",
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  AdminController.getTransactions,
);

// Single Transaction Details (Modal: Transaction ID, Recorded Date, Amount, Settled, Gateway, Provider Ref, Payer, Invoice)
router.get(
  "/transactions/:id",
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  AdminController.getTransactionById,
);

// Refund Transaction (Action from Modal)
router.post(
  "/transactions/:id/refund",
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  AdminController.refundTransaction,
);

// ==========================================
// User Management Routes (Users Tab in Dashboard)
// ==========================================

// 1. Users List (User Management Table: status tabs, plan filter, search, pagination)
router.get(
  "/users",
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  AdminController.getUsers,
);

// 2. User Overview Header & Details (Screen 2 Header & Stat Cards)
router.get(
  "/users/:id",
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  AdminController.getUserById,
);

// 3. User Properties & Units
router.get(
  "/users/:id/properties",
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  AdminController.getUserProperties,
);

// 4. User Tenants
router.get(
  "/users/:id/tenants",
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  AdminController.getUserTenants,
);

// 5. User Contractors
router.get(
  "/users/:id/contractors",
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  AdminController.getUserContractors,
);

// 6. Complete User Full Details (All-in-one for SPA Frontend)
router.get(
  "/users/:id/full-details",
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  AdminController.getUserFullDetails,
);

// 7. Update User Status (Auto-cascade suspend/activate)
router.patch(
  "/users/:id/status",
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  AdminController.updateUserStatus,
);
router.patch(
  "/users/:id/suspend",
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  AdminController.updateUserStatus,
);

// 8. Delete User (Cascade soft delete)
router.delete(
  "/users/:id",
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  AdminController.deleteUser,
);

// ==========================================
// Admin Jobs & Orders Routes
// ==========================================

// 1. Job requests list (Screenshot 1)
router.get(
  "/jobs",
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  AdminController.getAdminJobRequests,
);

// 2. Job request details (Screenshot 3)
router.get(
  "/jobs/:id",
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  AdminController.getAdminJobRequestById,
);

// 3. Orders list (Screenshot 2)
router.get(
  "/orders",
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  AdminController.getAdminOrders,
);

// 4. Tab counts (Job Requests count & Orders count)
router.get(
  "/jobs-and-orders/counts",
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  AdminController.getJobsAndOrdersCounts,
);

export const AdminRoutes = router;
