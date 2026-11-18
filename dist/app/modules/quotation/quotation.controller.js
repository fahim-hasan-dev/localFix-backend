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
exports.QuotationController = void 0;
const http_status_codes_1 = require("http-status-codes");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const quotation_service_1 = require("./quotation.service");
const createQuotation = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const result = yield quotation_service_1.QuotationService.createQuotationToDB(userId, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.CREATED,
        success: true,
        message: "Quotation submitted successfully",
        data: result,
    });
}));
const getQuotationById = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = req.user.id;
    const userRole = (_a = req.user) === null || _a === void 0 ? void 0 : _a.role;
    const result = yield quotation_service_1.QuotationService.getQuotationByIdFromDB(req.params.id, userId, userRole);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Quotation details retrieved successfully",
        data: result,
    });
}));
const acceptQuotation = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const result = yield quotation_service_1.QuotationService.acceptQuotationToDB(req.params.id, userId, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Quotation accepted and booking confirmed successfully",
        data: result,
    });
}));
const declineQuotation = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const result = yield quotation_service_1.QuotationService.declineQuotationToDB(req.params.id, userId, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Quotation declined successfully",
        data: result,
    });
}));
const getAllQuotations = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = req.user.id;
    const userRole = (_a = req.user) === null || _a === void 0 ? void 0 : _a.role;
    const result = yield quotation_service_1.QuotationService.getAllQuotationsFromDB(req.query, userId, userRole);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Quotations retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
}));
exports.QuotationController = {
    createQuotation,
    getQuotationById,
    acceptQuotation,
    declineQuotation,
    getAllQuotations,
};
