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
exports.NotificationController = void 0;
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const http_status_codes_1 = require("http-status-codes");
const notification_service_1 = require("./notification.service");
const getNotificationFromDB = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield notification_service_1.NotificationService.getNotificationFromDB(user, req.query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Notifications Retrieved Successfully",
        data: result.data,
        meta: result.meta,
    });
}));
const readNotification = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield notification_service_1.NotificationService.readNotificationToDB(user);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Notification Read Successfully",
        data: result,
    });
}));
const adminNotificationFromDB = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield notification_service_1.NotificationService.adminNotificationFromDB(req.query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Notifications Retrieved Successfully",
        data: result.data,
        meta: result.meta,
    });
}));
const adminReadNotification = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield notification_service_1.NotificationService.adminReadNotificationToDB();
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Notification Read Successfully",
        data: result,
    });
}));
// user single get
const getSingleNotification = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield notification_service_1.NotificationService.getSingleNotificationFromDB(req.user, req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: "Notification retrieved successfully",
        data: result,
    });
}));
// user single read
const readSingleNotification = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield notification_service_1.NotificationService.readSingleNotificationToDB(req.user, req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: "Notification marked as read",
        data: result,
    });
}));
// admin single get
const adminGetSingleNotification = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield notification_service_1.NotificationService.adminGetSingleNotificationFromDB(req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: "Admin notification retrieved successfully",
        data: result,
    });
}));
// admin single read
const adminReadSingleNotification = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield notification_service_1.NotificationService.adminReadSingleNotificationToDB(req.params.id);
    console.log(result, "RESULT");
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: "Admin notification marked as read",
        data: result,
    });
}));
// user single delete
const deleteSingleNotification = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield notification_service_1.NotificationService.deleteSingleNotificationFromDB(req.user, req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Notification deleted successfully",
        data: result,
    });
}));
// user delete notifications (all or selected ids)
const deleteNotification = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const ids = ((_a = req.body) === null || _a === void 0 ? void 0 : _a.ids) ||
        (((_b = req.query) === null || _b === void 0 ? void 0 : _b.ids)
            ? typeof req.query.ids === "string"
                ? req.query.ids.split(",")
                : req.query.ids
            : undefined);
    const result = yield notification_service_1.NotificationService.deleteNotificationsFromDB(req.user, ids);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Notifications deleted successfully",
        data: result,
    });
}));
// admin single delete
const adminDeleteSingleNotification = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield notification_service_1.NotificationService.adminDeleteSingleNotificationFromDB(req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Admin notification deleted successfully",
        data: result,
    });
}));
// admin delete notifications (all or selected ids)
const adminDeleteNotification = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const ids = ((_a = req.body) === null || _a === void 0 ? void 0 : _a.ids) ||
        (((_b = req.query) === null || _b === void 0 ? void 0 : _b.ids)
            ? typeof req.query.ids === "string"
                ? req.query.ids.split(",")
                : req.query.ids
            : undefined);
    const result = yield notification_service_1.NotificationService.adminDeleteNotificationsFromDB(ids);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Admin notifications deleted successfully",
        data: result,
    });
}));
exports.NotificationController = {
    adminNotificationFromDB,
    getNotificationFromDB,
    readNotification,
    adminReadNotification,
    getSingleNotification,
    readSingleNotification,
    adminGetSingleNotification,
    adminReadSingleNotification,
    deleteSingleNotification,
    deleteNotification,
    adminDeleteSingleNotification,
    adminDeleteNotification,
};
