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
exports.FavoriteController = void 0;
const http_status_codes_1 = require("http-status-codes");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const favorite_service_1 = require("./favorite.service");
const ApiErrors_1 = __importDefault(require("../../../errors/ApiErrors"));
const toggleFavorite = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    const { id: userId } = req.user;
    const referenceId = ((_a = req.body) === null || _a === void 0 ? void 0 : _a.referenceId) ||
        ((_b = req.body) === null || _b === void 0 ? void 0 : _b.id) ||
        ((_c = req.params) === null || _c === void 0 ? void 0 : _c.referenceId) ||
        ((_d = req.params) === null || _d === void 0 ? void 0 : _d.id);
    if (!referenceId) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "referenceId is required to toggle favorite");
    }
    const result = yield favorite_service_1.FavoriteService.toggleFavorite({
        userId,
        referenceId,
    });
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: result.message,
        data: result,
    });
}));
const getFavorites = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id: userId } = req.user;
    const result = yield favorite_service_1.FavoriteService.getFavorites(userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Favorites retrieved successfully",
        data: result,
    });
}));
const checkFavoriteStatus = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const { id: userId } = req.user;
    const referenceId = ((_a = req.params) === null || _a === void 0 ? void 0 : _a.referenceId) ||
        ((_b = req.params) === null || _b === void 0 ? void 0 : _b.id) ||
        ((_c = req.query) === null || _c === void 0 ? void 0 : _c.referenceId);
    if (!referenceId) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "referenceId is required to check status");
    }
    const result = yield favorite_service_1.FavoriteService.checkFavoriteStatus(userId, referenceId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Favorite status checked successfully",
        data: result,
    });
}));
const getSingleFavorite = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id: userId } = req.user;
    const id = req.params.id || req.params.bookmarkId;
    const result = yield favorite_service_1.FavoriteService.getSingleFavorite(userId, id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Favorite retrieved successfully",
        data: result,
    });
}));
const deleteFavorite = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id: userId } = req.user;
    const referenceId = req.params.referenceId || req.params.id;
    const result = yield favorite_service_1.FavoriteService.deleteFavorite(userId, referenceId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: result.message,
        data: result,
    });
}));
exports.FavoriteController = {
    toggleFavorite,
    getFavorites,
    checkFavoriteStatus,
    getSingleFavorite,
    deleteFavorite,
};
