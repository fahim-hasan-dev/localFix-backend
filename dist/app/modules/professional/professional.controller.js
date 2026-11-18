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
exports.ProfessionalController = void 0;
const http_status_codes_1 = require("http-status-codes");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const professional_service_1 = require("./professional.service");
const ApiErrors_1 = __importDefault(require("../../../errors/ApiErrors"));
const user_1 = require("../../../enums/user");
const getAllProfessionals = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const currentUserId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) ||
        ((_b = req.user) === null || _b === void 0 ? void 0 : _b.userId) ||
        ((_c = req.user) === null || _c === void 0 ? void 0 : _c._id);
    const result = yield professional_service_1.ProfessionalService.getAllProfessionalsFromDB(req.query, currentUserId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Professionals retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
}));
const getTopRatedProfessionals = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const currentUserId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) ||
        ((_b = req.user) === null || _b === void 0 ? void 0 : _b.userId) ||
        ((_c = req.user) === null || _c === void 0 ? void 0 : _c._id);
    const result = yield professional_service_1.ProfessionalService.getTopRatedProfessionalsFromDB(req.query, currentUserId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Top-rated professionals retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
}));
const getProfessionalDetails = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const currentUserId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) ||
        ((_b = req.user) === null || _b === void 0 ? void 0 : _b.userId) ||
        ((_c = req.user) === null || _c === void 0 ? void 0 : _c._id);
    const result = yield professional_service_1.ProfessionalService.getProfessionalDetailsFromDB(req.params.professionalId, currentUserId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Professional details retrieved successfully",
        data: result,
    });
}));
const getProfessionalAnalytics = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    let targetProfessionalId = (user === null || user === void 0 ? void 0 : user.id) || (user === null || user === void 0 ? void 0 : user.userId) || (user === null || user === void 0 ? void 0 : user._id);
    // If an Admin/Super Admin is accessing and provides a specific professionalId, use it
    if (((user === null || user === void 0 ? void 0 : user.role) === user_1.USER_ROLES.ADMIN ||
        (user === null || user === void 0 ? void 0 : user.role) === user_1.USER_ROLES.SUPER_ADMIN) &&
        req.query.professionalId) {
        targetProfessionalId = req.query.professionalId;
    }
    if (!targetProfessionalId) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Professional ID is required");
    }
    const result = yield professional_service_1.ProfessionalService.getProfessionalAnalyticsFromDB(targetProfessionalId, req.query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Professional analytics retrieved successfully",
        data: result,
    });
}));
const getProfessionalHistory = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    let targetProfessionalId = (user === null || user === void 0 ? void 0 : user.id) || (user === null || user === void 0 ? void 0 : user.userId) || (user === null || user === void 0 ? void 0 : user._id);
    // If an Admin/Super Admin is accessing and provides a specific professionalId, use it
    if (((user === null || user === void 0 ? void 0 : user.role) === user_1.USER_ROLES.ADMIN ||
        (user === null || user === void 0 ? void 0 : user.role) === user_1.USER_ROLES.SUPER_ADMIN) &&
        req.query.professionalId) {
        targetProfessionalId = req.query.professionalId;
    }
    if (!targetProfessionalId) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Professional ID is required");
    }
    const result = yield professional_service_1.ProfessionalService.getProfessionalHistoryFromDB(targetProfessionalId, req.query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Professional job history retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
}));
const getProfessionalApplication = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    let targetProfessionalId = (user === null || user === void 0 ? void 0 : user.id) || (user === null || user === void 0 ? void 0 : user.userId) || (user === null || user === void 0 ? void 0 : user._id);
    // If an Admin/Super Admin is accessing and provides a specific professionalId, use it
    if (((user === null || user === void 0 ? void 0 : user.role) === user_1.USER_ROLES.ADMIN ||
        (user === null || user === void 0 ? void 0 : user.role) === user_1.USER_ROLES.SUPER_ADMIN) &&
        req.query.professionalId) {
        targetProfessionalId = req.query.professionalId;
    }
    if (!targetProfessionalId) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Professional ID is required");
    }
    const result = yield professional_service_1.ProfessionalService.getProfessionalApplicationFromDB(targetProfessionalId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Professional application details retrieved successfully",
        data: result,
    });
}));
exports.ProfessionalController = {
    getAllProfessionals,
    getTopRatedProfessionals,
    getProfessionalDetails,
    getProfessionalAnalytics,
    getProfessionalHistory,
    getProfessionalApplication,
};
