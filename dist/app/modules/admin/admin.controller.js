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
exports.AdminController = void 0;
const http_status_codes_1 = require("http-status-codes");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const admin_service_1 = require("./admin.service");
// 1. Existing Dashboard summary stats
const getAdminDashboardData = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield admin_service_1.AdminService.getAdminDashboardDataFromDB();
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Admin dashboard data retrieved successfully",
        data: result,
    });
}));
// 2. Monthly Revenue - Pro subscription income
const getMonthlyRevenue = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const year = req.query.year ? Number(req.query.year) : undefined;
    const result = yield admin_service_1.AdminService.getMonthlyRevenueFromDB(year);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Monthly revenue retrieved successfully",
        data: result,
    });
}));
// 3. User Growth - Registered homeowners & verified pros
const getUserGrowth = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const year = req.query.year ? Number(req.query.year) : undefined;
    const result = yield admin_service_1.AdminService.getUserGrowthFromDB(year);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "User growth retrieved successfully",
        data: result,
    });
}));
// 4. Transaction Summary Cards (Paying Pros, Transactions, Total Collected)
const getTransactionStats = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield admin_service_1.AdminService.getTransactionStatsFromDB(req.query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Transaction summary stats retrieved successfully",
        data: result,
    });
}));
// 5. Transactions List (Table with search, plan tier, status tabs, date filter, pagination)
const getTransactions = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield admin_service_1.AdminService.getTransactionsFromDB(req.query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Transactions retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
}));
// 5.1 Single Transaction Details (For Modal: Transaction ID, Recorded Date, Amount, Settled, Gateway, Provider Ref, Payer, Invoice)
const getTransactionById = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const result = yield admin_service_1.AdminService.getTransactionByIdFromDB(id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Transaction details retrieved successfully",
        data: result,
    });
}));
// 5.2 Refund Transaction (Action from Modal)
const refundTransaction = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const result = yield admin_service_1.AdminService.refundTransactionToDB(id, req.body.reason);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: result.message,
        data: result,
    });
}));
// 6. Users List (User Management Screen Table)
const getUsers = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield admin_service_1.AdminService.getUsersFromDB(req.query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Users retrieved successfully",
        meta: Object.assign(Object.assign({}, result.meta), { summary: result.summary }),
        data: result.data,
    });
}));
// 7. User Overview Header & Detail
const getUserById = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const result = yield admin_service_1.AdminService.getUserByIdFromDB(id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "User details retrieved successfully",
        data: result,
    });
}));
// 8. User Properties & Units
const getUserProperties = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const result = yield admin_service_1.AdminService.getUserPropertiesFromDB(id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "User properties retrieved successfully",
        data: result,
    });
}));
// 9. User Tenants
const getUserTenants = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const result = yield admin_service_1.AdminService.getUserTenantsFromDB(id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "User tenants retrieved successfully",
        data: result,
    });
}));
// 10. User Contractors
const getUserContractors = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const result = yield admin_service_1.AdminService.getUserContractorsFromDB(id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "User contractors retrieved successfully",
        data: result,
    });
}));
// 11. User Full Details (All-in-one for SPA Frontend)
const getUserFullDetails = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const result = yield admin_service_1.AdminService.getUserFullDetailsFromDB(id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "User full details retrieved successfully",
        data: result,
    });
}));
// 12. Update User Status (Auto-cascade suspend/activate)
const updateUserStatus = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const status = req.body.status || (req.path.includes("suspend") ? "suspended" : "active");
    const result = yield admin_service_1.AdminService.updateUserStatusToDB(id, status);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: result.message,
        data: result,
    });
}));
// 13. Delete User (Cascade soft delete)
const deleteUser = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const result = yield admin_service_1.AdminService.deleteUserFromDB(id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: result.message,
        data: result,
    });
}));
// 14. Get Admin Job Requests (Jobs & Orders tab 1: search, category filter, status filter, pagination)
const getAdminJobRequests = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield admin_service_1.AdminService.getAdminJobRequestsFromDB(req.query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Admin job requests retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
}));
// 15. Get Admin Single Job Request Details (Screenshot 3)
const getAdminJobRequestById = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const result = yield admin_service_1.AdminService.getAdminJobRequestByIdFromDB(id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Job request details retrieved successfully",
        data: result,
    });
}));
// 16. Get Admin Orders (Jobs & Orders tab 2: search, stage filter, category filter, pagination)
const getAdminOrders = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield admin_service_1.AdminService.getAdminOrdersFromDB(req.query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Admin orders retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
}));
// 17. Get Admin Single Order Details (Screenshot 4)
const getAdminOrderById = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const result = yield admin_service_1.AdminService.getAdminOrderByIdFromDB(id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Order details retrieved successfully",
        data: result,
    });
}));
// 18. Get Admin Jobs & Orders Tab Counts
const getJobsAndOrdersCounts = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield admin_service_1.AdminService.getJobsAndOrdersCountsFromDB();
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Jobs and orders counts retrieved successfully",
        data: result,
    });
}));
exports.AdminController = {
    getAdminDashboardData,
    getAdminDashboardStats: getAdminDashboardData,
    getMonthlyRevenue,
    getUserGrowth,
    getTransactionStats,
    getTransactions,
    getTransactionById,
    refundTransaction,
    getUsers,
    getUserById,
    getUserProperties,
    getUserTenants,
    getUserContractors,
    getUserFullDetails,
    updateUserStatus,
    deleteUser,
    getAdminJobRequests,
    getAdminJobRequestById,
    getAdminOrders,
    getAdminOrderById,
    getJobsAndOrdersCounts,
};
