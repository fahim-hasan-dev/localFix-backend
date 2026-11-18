"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminRoutes = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../../middlewares/auth"));
const user_1 = require("../../../enums/user");
const admin_controller_1 = require("./admin.controller");
const router = express_1.default.Router();
// Admin Dashboard Summary Cards (Stats)
router.get("/stats", (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), admin_controller_1.AdminController.getAdminDashboardData);
// Revenue Over Time (Platform revenue overview)
router.get("/revenue", (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), admin_controller_1.AdminController.getMonthlyRevenue);
// User Growth (Cumulative registrations: Homeowners & Verified Pros)
router.get("/user-growth", (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), admin_controller_1.AdminController.getUserGrowth);
// Transaction Summary Cards (Paying Pros, Transactions, Total Collected)
router.get("/transactions/stats", (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), admin_controller_1.AdminController.getTransactionStats);
// Transactions List (Table with search, plan tier, status tabs, date filter, pagination, CSV export)
router.get("/transactions", (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), admin_controller_1.AdminController.getTransactions);
// Single Transaction Details (Modal: Transaction ID, Recorded Date, Amount, Settled, Gateway, Provider Ref, Payer, Invoice)
router.get("/transactions/:id", (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), admin_controller_1.AdminController.getTransactionById);
// Refund Transaction (Action from Modal)
router.post("/transactions/:id/refund", (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), admin_controller_1.AdminController.refundTransaction);
// ==========================================
// User Management Routes (Users Tab in Dashboard)
// ==========================================
// 1. Users List (User Management Table: status tabs, plan filter, search, pagination)
router.get("/users", (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), admin_controller_1.AdminController.getUsers);
// 2. User Overview Header & Details (Screen 2 Header & Stat Cards)
router.get("/users/:id", (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), admin_controller_1.AdminController.getUserById);
// 3. User Properties & Units
router.get("/users/:id/properties", (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), admin_controller_1.AdminController.getUserProperties);
// 4. User Tenants
router.get("/users/:id/tenants", (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), admin_controller_1.AdminController.getUserTenants);
// 5. User Contractors
router.get("/users/:id/contractors", (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), admin_controller_1.AdminController.getUserContractors);
// 6. Complete User Full Details (All-in-one for SPA Frontend)
router.get("/users/:id/full-details", (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), admin_controller_1.AdminController.getUserFullDetails);
// 7. Update User Status (Auto-cascade suspend/activate)
router.patch("/users/:id/status", (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), admin_controller_1.AdminController.updateUserStatus);
router.patch("/users/:id/suspend", (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), admin_controller_1.AdminController.updateUserStatus);
// 8. Delete User (Cascade soft delete)
router.delete("/users/:id", (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), admin_controller_1.AdminController.deleteUser);
// ==========================================
// Admin Jobs & Orders Routes
// ==========================================
// 1. Job requests list (Screenshot 1)
router.get("/jobs", (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), admin_controller_1.AdminController.getAdminJobRequests);
// 2. Job request details (Screenshot 3)
router.get("/jobs/:id", (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), admin_controller_1.AdminController.getAdminJobRequestById);
// 3. Orders list (Screenshot 2)
router.get("/orders", (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), admin_controller_1.AdminController.getAdminOrders);
// 4. Tab counts (Job Requests count & Orders count)
router.get("/jobs-and-orders/counts", (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), admin_controller_1.AdminController.getJobsAndOrdersCounts);
exports.AdminRoutes = router;
