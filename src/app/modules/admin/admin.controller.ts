import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { AdminService } from "./admin.service";

// 1. Existing Dashboard summary stats
const getAdminDashboardData = catchAsync(
  async (req: Request, res: Response) => {
    const result = await AdminService.getAdminDashboardDataFromDB();

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "Admin dashboard data retrieved successfully",
      data: result,
    });
  },
);

// 2. Monthly Revenue - Pro subscription income
const getMonthlyRevenue = catchAsync(async (req: Request, res: Response) => {
  const year = req.query.year ? Number(req.query.year) : undefined;
  const result = await AdminService.getMonthlyRevenueFromDB(year);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Monthly revenue retrieved successfully",
    data: result,
  });
});

// 3. User Growth - Registered homeowners & verified pros
const getUserGrowth = catchAsync(async (req: Request, res: Response) => {
  const year = req.query.year ? Number(req.query.year) : undefined;
  const result = await AdminService.getUserGrowthFromDB(year);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "User growth retrieved successfully",
    data: result,
  });
});

// 4. Transaction Summary Cards (Paying Pros, Transactions, Total Collected)
const getTransactionStats = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminService.getTransactionStatsFromDB(req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Transaction summary stats retrieved successfully",
    data: result,
  });
});

// 5. Transactions List (Table with search, plan tier, status tabs, date filter, pagination)
const getTransactions = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminService.getTransactionsFromDB(req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Transactions retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

// 5.1 Single Transaction Details (For Modal: Transaction ID, Recorded Date, Amount, Settled, Gateway, Provider Ref, Payer, Invoice)
const getTransactionById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await AdminService.getTransactionByIdFromDB(id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Transaction details retrieved successfully",
    data: result,
  });
});

// 5.2 Refund Transaction (Action from Modal)
const refundTransaction = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await AdminService.refundTransactionToDB(id, req.body.reason);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: result.message,
    data: result,
  });
});

// 6. Users List (User Management Screen Table)
const getUsers = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminService.getUsersFromDB(req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Users retrieved successfully",
    meta: {
      ...result.meta,
      summary: result.summary,
    },
    data: result.data,
  });
});

// 7. User Overview Header & Detail
const getUserById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await AdminService.getUserByIdFromDB(id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "User details retrieved successfully",
    data: result,
  });
});

// 8. User Properties & Units
const getUserProperties = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await AdminService.getUserPropertiesFromDB(id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "User properties retrieved successfully",
    data: result,
  });
});

// 9. User Tenants
const getUserTenants = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await AdminService.getUserTenantsFromDB(id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "User tenants retrieved successfully",
    data: result,
  });
});

// 10. User Contractors
const getUserContractors = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await AdminService.getUserContractorsFromDB(id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "User contractors retrieved successfully",
    data: result,
  });
});

// 11. User Full Details (All-in-one for SPA Frontend)
const getUserFullDetails = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await AdminService.getUserFullDetailsFromDB(id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "User full details retrieved successfully",
    data: result,
  });
});

// 12. Update User Status (Auto-cascade suspend/activate)
const updateUserStatus = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const status =
    req.body.status || (req.path.includes("suspend") ? "suspended" : "active");

  const result = await AdminService.updateUserStatusToDB(id, status);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: result.message,
    data: result,
  });
});

// 13. Delete User (Cascade soft delete)
const deleteUser = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await AdminService.deleteUserFromDB(id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: result.message,
    data: result,
  });
});

// 14. Get Admin Job Requests (Jobs & Orders tab 1: search, category filter, status filter, pagination)
const getAdminJobRequests = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminService.getAdminJobRequestsFromDB(req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Admin job requests retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

// 15. Get Admin Single Job Request Details (Screenshot 3)
const getAdminJobRequestById = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await AdminService.getAdminJobRequestByIdFromDB(id);

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "Job request details retrieved successfully",
      data: result,
    });
  },
);

// 16. Get Admin Orders (Jobs & Orders tab 2: search, stage filter, category filter, pagination)
const getAdminOrders = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminService.getAdminOrdersFromDB(req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Admin orders retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

// 17. Get Admin Single Order Details (Screenshot 4)
const getAdminOrderById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await AdminService.getAdminOrderByIdFromDB(id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Order details retrieved successfully",
    data: result,
  });
});

// 18. Get Admin Jobs & Orders Tab Counts
const getJobsAndOrdersCounts = catchAsync(
  async (req: Request, res: Response) => {
    const result = await AdminService.getJobsAndOrdersCountsFromDB();

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "Jobs and orders counts retrieved successfully",
      data: result,
    });
  },
);

export const AdminController = {
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
