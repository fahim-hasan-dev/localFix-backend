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
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendNotifications = void 0;
const notification_model_1 = require("../app/modules/notification/notification.model");
const pushNotification_1 = require("../app/builder/pushNotification");
const notification_constant_1 = require("../app/modules/notification/notification.constant");
const sendNotifications = (data) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    if (data.type === notification_constant_1.NOTIFICATION_TYPE.ADMIN ||
        data.type === notification_constant_1.NOTIFICATION_TYPE.SUPER_ADMIN) {
        // For Admin and super admin, keep the existing Socket.io & DB logic
        const result = yield (yield notification_model_1.Notification.create(data)).populate("receiver sender referenceId");
        //@ts-ignore
        const socketIo = global.io;
        if (socketIo) {
            socketIo.emit(`send-notification::${data === null || data === void 0 ? void 0 : data.receiver}`, result);
        }
        return result;
    }
    else {
        // For user events (home_owner, professional, subscription_update, review_update, message_new, etc.)
        if (!data.receiver)
            return;
        const payload = {
            title: data.title || "Notification",
            body: data.text || "",
            type: data.type || "",
            data: {
                type: data.type || "",
                referenceId: ((_a = data.referenceId) === null || _a === void 0 ? void 0 : _a.toString()) || "",
                referenceModel: data.referenceModel || "",
                sender: ((_b = data.sender) === null || _b === void 0 ? void 0 : _b.toString()) || "",
            },
        };
        return yield pushNotification_1.notificationHelper.sendToUser(data.receiver.toString(), payload);
    }
});
exports.sendNotifications = sendNotifications;
