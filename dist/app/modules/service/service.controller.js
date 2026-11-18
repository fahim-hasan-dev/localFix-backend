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
exports.ServiceController = void 0;
const http_status_codes_1 = require("http-status-codes");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const service_service_1 = require("./service.service");
const getProfessionalsByCategory = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const currentUserId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) ||
        ((_b = req.user) === null || _b === void 0 ? void 0 : _b.userId) ||
        ((_c = req.user) === null || _c === void 0 ? void 0 : _c._id);
    const result = yield service_service_1.ServiceService.getProfessionalsByCategoryFromDB(req.query, currentUserId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Professionals retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
}));
const getProfessionalDetails = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const currentUserId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) ||
        ((_b = req.user) === null || _b === void 0 ? void 0 : _b.userId) ||
        ((_c = req.user) === null || _c === void 0 ? void 0 : _c._id);
    const result = yield service_service_1.ServiceService.getProfessionalDetailsFromDB(req.params.professionalId, currentUserId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Professional details retrieved successfully",
        data: result,
    });
}));
const createService = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id: professionalId } = req.user;
    const result = yield service_service_1.ServiceService.createServiceToDB(professionalId, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.CREATED,
        success: true,
        message: "Service created successfully",
        data: result,
    });
}));
const getMyServices = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id: professionalId } = req.user;
    const result = yield service_service_1.ServiceService.getMyServicesFromDB(professionalId, req.query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Services retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
}));
const getMyServiceById = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id: professionalId } = req.user;
    const result = yield service_service_1.ServiceService.getMyServiceByIdFromDB(professionalId, req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Service retrieved successfully",
        data: result,
    });
}));
const updateMyService = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id: professionalId } = req.user;
    const result = yield service_service_1.ServiceService.updateMyServiceToDB(professionalId, req.params.id, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Service updated successfully",
        data: result,
    });
}));
const deleteMyService = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id: professionalId } = req.user;
    const result = yield service_service_1.ServiceService.deleteMyServiceFromDB(professionalId, req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Service deleted successfully",
        data: result,
    });
}));
exports.ServiceController = {
    getProfessionalsByCategory,
    getAllProfessionals: getProfessionalsByCategory,
    getProfessionalDetails,
    createService,
    getMyServices,
    getMyServiceById,
    updateMyService,
    deleteMyService,
};
