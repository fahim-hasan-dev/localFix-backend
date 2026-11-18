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
exports.NotificationService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const http_status_codes_1 = require("http-status-codes");
const ApiErrors_1 = __importDefault(require("../../../errors/ApiErrors"));
const user_1 = require("../../../enums/user");
const notification_model_1 = require("./notification.model");
const queryBuilder_1 = __importDefault(require("../../builder/queryBuilder"));
const notification_constant_1 = require("./notification.constant");
// get notifications
const getNotificationFromDB = (user, query) => __awaiter(void 0, void 0, void 0, function* () {
    const filter = {
        receiver: user.id,
    };
    // If specific notification type is requested
    if (query.type && typeof query.type === "string") {
        filter.type = query.type;
    }
    // If unread only requested
    if (query.unreadOnly === "true" || query.read === "false") {
        filter.read = false;
    }
    else if (query.read === "true") {
        filter.read = true;
    }
    const requestedLimit = Number(query.limit);
    const listQuery = Object.assign(Object.assign({}, query), { limit: Number.isFinite(requestedLimit) && requestedLimit > 0
            ? Math.min(Math.floor(requestedLimit), 20)
            : 20 });
    const baseQuery = notification_model_1.Notification.find(filter).populate([
        { path: "receiver" },
        { path: "sender" },
        { path: "referenceId" },
    ]);
    const unreadCount = yield notification_model_1.Notification.countDocuments({
        receiver: user.id,
        read: false,
    });
    const queryBuilder = new queryBuilder_1.default(baseQuery, listQuery)
        .filter()
        .sort()
        .paginate();
    const result = yield queryBuilder.modelQuery;
    const meta = yield queryBuilder.countTotal();
    return {
        data: result,
        meta: Object.assign(Object.assign({}, meta), { unreadCount }),
    };
});
// read notifications only for user
const readNotificationToDB = (user) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield notification_model_1.Notification.updateMany({
        receiver: user.id,
        read: false,
    }, { $set: { read: true } });
    return result;
});
// get notifications for admin
const adminNotificationFromDB = (query) => __awaiter(void 0, void 0, void 0, function* () {
    const listQuery = Object.assign(Object.assign({}, query), { limit: Number(query.limit) > 0 ? query.limit : 100 });
    const baseQuery = notification_model_1.Notification.find({
        type: notification_constant_1.NOTIFICATION_TYPE.ADMIN,
    }).populate([
        { path: "receiver" },
        { path: "sender" },
        { path: "referenceId" },
    ]);
    const unreadCount = yield notification_model_1.Notification.countDocuments({
        type: notification_constant_1.NOTIFICATION_TYPE.ADMIN,
        read: false,
    });
    const queryBuilder = new queryBuilder_1.default(baseQuery, listQuery).sort().paginate();
    const result = yield queryBuilder.modelQuery;
    const meta = yield queryBuilder.countTotal();
    return {
        data: result,
        meta: Object.assign(Object.assign({}, meta), { unreadCount }),
    };
});
// read notifications only for admin
const adminReadNotificationToDB = () => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield notification_model_1.Notification.updateMany({ type: notification_constant_1.NOTIFICATION_TYPE.ADMIN, read: false }, { $set: { read: true } });
    return result;
});
// get single notification (user)
const getSingleNotificationFromDB = (user, id) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield notification_model_1.Notification.findOne({
        _id: id,
        receiver: user.id,
    }).populate([
        { path: "receiver" },
        { path: "sender" },
        { path: "referenceId" },
    ]);
    return result;
});
// read single notification (user)
const readSingleNotificationToDB = (user, id) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield notification_model_1.Notification.findOneAndUpdate({ _id: id, receiver: user.id }, { $set: { read: true } }, { new: true });
    return result;
});
// admin get single notification
const adminGetSingleNotificationFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield notification_model_1.Notification.findOne({
        _id: id,
        type: notification_constant_1.NOTIFICATION_TYPE.ADMIN,
    }).populate([
        { path: "receiver" },
        { path: "sender" },
        { path: "referenceId" },
    ]);
    return result;
});
// admin read single notification
const adminReadSingleNotificationToDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield notification_model_1.Notification.findOneAndUpdate({ _id: id, type: notification_constant_1.NOTIFICATION_TYPE.ADMIN }, { $set: { read: true } }, { new: true });
    return result;
});
// delete single notification (user or admin)
const deleteSingleNotificationFromDB = (user, id) => __awaiter(void 0, void 0, void 0, function* () {
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Invalid notification ID");
    }
    const filter = { _id: id };
    // If non-admin user (home_owner, professional), restrict deletion to their own notifications
    if (user.role !== user_1.USER_ROLES.ADMIN && user.role !== user_1.USER_ROLES.SUPER_ADMIN) {
        filter.receiver = user.id;
    }
    const notification = yield notification_model_1.Notification.findOne(filter);
    if (!notification) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Notification not found or you are not authorized to delete it");
    }
    const result = yield notification_model_1.Notification.softDeleteById(id);
    return result;
});
// delete multiple or all notifications for user
const deleteNotificationsFromDB = (user, ids) => __awaiter(void 0, void 0, void 0, function* () {
    const filter = { receiver: user.id };
    if (ids && Array.isArray(ids) && ids.length > 0) {
        const validIds = ids.filter((id) => mongoose_1.default.Types.ObjectId.isValid(id));
        if (validIds.length === 0) {
            throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "No valid notification IDs provided");
        }
        filter._id = { $in: validIds };
    }
    const result = yield notification_model_1.Notification.softDeleteMany(filter);
    return result;
});
// admin delete single notification
const adminDeleteSingleNotificationFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Invalid notification ID");
    }
    const notification = yield notification_model_1.Notification.findOne({
        _id: id,
        type: notification_constant_1.NOTIFICATION_TYPE.ADMIN,
    });
    if (!notification) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Admin notification not found");
    }
    const result = yield notification_model_1.Notification.softDeleteById(id);
    return result;
});
// admin delete multiple or all notifications
const adminDeleteNotificationsFromDB = (ids) => __awaiter(void 0, void 0, void 0, function* () {
    const filter = { type: notification_constant_1.NOTIFICATION_TYPE.ADMIN };
    if (ids && Array.isArray(ids) && ids.length > 0) {
        const validIds = ids.filter((id) => mongoose_1.default.Types.ObjectId.isValid(id));
        if (validIds.length === 0) {
            throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "No valid notification IDs provided");
        }
        filter._id = { $in: validIds };
    }
    const result = yield notification_model_1.Notification.softDeleteMany(filter);
    return result;
});
exports.NotificationService = {
    adminNotificationFromDB,
    getNotificationFromDB,
    readNotificationToDB,
    adminReadNotificationToDB,
    getSingleNotificationFromDB,
    readSingleNotificationToDB,
    adminGetSingleNotificationFromDB,
    adminReadSingleNotificationToDB,
    deleteSingleNotificationFromDB,
    deleteNotificationsFromDB,
    adminDeleteSingleNotificationFromDB,
    adminDeleteNotificationsFromDB,
};
