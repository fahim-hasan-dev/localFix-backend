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
exports.MarqueeController = void 0;
const http_status_codes_1 = require("http-status-codes");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const marquee_service_1 = require("./marquee.service");
const createMarquee = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield marquee_service_1.MarqueeService.createMarqueeToDB(req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.CREATED,
        success: true,
        message: "Marquee keyword created successfully",
        data: result,
    });
}));
const getMarquees = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield marquee_service_1.MarqueeService.getMarqueesFromDB(req.query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Marquee keywords retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
}));
const getMarqueeById = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield marquee_service_1.MarqueeService.getMarqueeByIdFromDB(req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Marquee keyword retrieved successfully",
        data: result,
    });
}));
const updateMarquee = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield marquee_service_1.MarqueeService.updateMarqueeToDB(req.params.id, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Marquee keyword updated successfully",
        data: result,
    });
}));
const deleteMarquee = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield marquee_service_1.MarqueeService.deleteMarqueeFromDB(req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Marquee keyword deleted successfully",
        data: result,
    });
}));
const getMarqueeStatus = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield marquee_service_1.MarqueeService.getMarqueeStatusFromDB();
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Marquee status retrieved successfully",
        data: result,
    });
}));
const toggleMarqueeStatus = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const result = yield marquee_service_1.MarqueeService.toggleMarqueeStatusToDB((_a = req.body) === null || _a === void 0 ? void 0 : _a.isEnabled);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: `Homepage marquee ${result.isEnabled ? "enabled" : "disabled"} successfully`,
        data: result,
    });
}));
exports.MarqueeController = {
    createMarquee,
    getMarquees,
    getMarqueeById,
    updateMarquee,
    deleteMarquee,
    getMarqueeStatus,
    toggleMarqueeStatus,
};
