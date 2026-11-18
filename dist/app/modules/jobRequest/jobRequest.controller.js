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
exports.JobRequestController = void 0;
const http_status_codes_1 = require("http-status-codes");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const jobRequest_service_1 = require("./jobRequest.service");
const createJobRequest = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const result = yield jobRequest_service_1.JobRequestService.createJobRequestToDB(userId, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.CREATED,
        success: true,
        message: "Job request created successfully",
        data: result,
    });
}));
const getMyJobRequests = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = req.user.id;
    const userRole = (_a = req.user) === null || _a === void 0 ? void 0 : _a.role;
    const result = yield jobRequest_service_1.JobRequestService.getMyJobRequestsFromDB(userId, userRole, req.query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Job requests retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
}));
const getJobRequestById = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = req.user.id;
    const userRole = (_a = req.user) === null || _a === void 0 ? void 0 : _a.role;
    const result = yield jobRequest_service_1.JobRequestService.getJobRequestByIdFromDB(req.params.id, userId, userRole);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Job request details retrieved successfully",
        data: result,
    });
}));
const updateJobRequest = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = req.user.id;
    const userRole = (_a = req.user) === null || _a === void 0 ? void 0 : _a.role;
    const result = yield jobRequest_service_1.JobRequestService.updateJobRequestToDB(req.params.id, userId, userRole, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Job request updated successfully",
        data: result,
    });
}));
const deleteJobRequest = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = req.user.id;
    const userRole = (_a = req.user) === null || _a === void 0 ? void 0 : _a.role;
    const result = yield jobRequest_service_1.JobRequestService.deleteJobRequestFromDB(req.params.id, userId, userRole);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Job request deleted successfully",
        data: result,
    });
}));
const getMarketplaceLeads = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const result = yield jobRequest_service_1.JobRequestService.getMarketplaceLeadsFromDB(userId, req.query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Marketplace leads retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
}));
const getSingleMarketplaceLead = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const result = yield jobRequest_service_1.JobRequestService.getSingleMarketplaceLeadFromDB(req.params.id, userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Marketplace lead details retrieved successfully",
        data: result,
    });
}));
const rejectMarketplaceLead = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const result = yield jobRequest_service_1.JobRequestService.rejectMarketplaceLeadInDB(req.params.id, userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Marketplace lead rejected successfully",
        data: result,
    });
}));
const getDirectRequests = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const result = yield jobRequest_service_1.JobRequestService.getDirectRequestsFromDB(userId, req.query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Direct requests retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
}));
const getSingleDirectRequest = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const result = yield jobRequest_service_1.JobRequestService.getSingleDirectRequestFromDB(req.params.id, userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Direct request details retrieved successfully",
        data: result,
    });
}));
const rejectDirectRequest = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const result = yield jobRequest_service_1.JobRequestService.rejectDirectRequestInDB(req.params.id, userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Direct request rejected successfully",
        data: result,
    });
}));
const rejectJobRequest = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const result = yield jobRequest_service_1.JobRequestService.rejectJobRequestInDB(req.params.id, userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Job request rejected successfully",
        data: result,
    });
}));
const getQuoteRequestsCount = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const result = yield jobRequest_service_1.JobRequestService.getQuoteRequestsCountFromDB(userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Quote requests count retrieved successfully",
        data: result,
    });
}));
const getMyProposals = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const result = yield jobRequest_service_1.JobRequestService.getMyProposalsFromDB(userId, req.query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "My proposals retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
}));
exports.JobRequestController = {
    createJobRequest,
    getMyJobRequests,
    getJobRequestById,
    updateJobRequest,
    deleteJobRequest,
    getMarketplaceLeads,
    getSingleMarketplaceLead,
    rejectMarketplaceLead,
    getDirectRequests,
    getSingleDirectRequest,
    rejectDirectRequest,
    rejectJobRequest,
    getQuoteRequestsCount,
    getMyProposals,
};
