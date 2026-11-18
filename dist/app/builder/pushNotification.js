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
exports.notificationHelper = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const user_model_1 = require("../modules/user/user.model");
const notification_model_1 = require("../modules/notification/notification.model");
const notification_constant_1 = require("../modules/notification/notification.constant");
const logger_1 = require("../../shared/logger");
const colors_1 = __importDefault(require("colors"));
const fcmToken_model_1 = require("../modules/fcmToken/fcmToken.model");
const firebase_1 = require("../../config/firebase");
const emailHelper_1 = require("../../helpers/emailHelper");
const emailTemplate_1 = require("../../shared/emailTemplate");
class NotificationHelper {
    /**
     * 🟢 MAIN METHOD: SEND TO SINGLE USER
     * Usage: notificationHelper.sendToUser(userId, payload);
     */
    sendToUser(userId, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.sendToBatch([userId], payload);
        });
    }
    /**
     * 🔵 MAIN METHOD: SEND TO MULTIPLE USERS
     * Usage: notificationHelper.sendToBatch([id1, id2, id3], payload);
     */
    sendToBatch(userIds, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!userIds.length)
                    return;
                // 1. Filter Users: Only get users who exist and are active
                const validUsers = yield user_model_1.User.find({
                    _id: { $in: userIds },
                    status: "active",
                })
                    .select("_id email")
                    .lean();
                const validUserIds = validUsers.map((u) => u._id);
                if (validUserIds.length === 0)
                    return;
                // 2. Fetch FCM Tokens for valid users
                let fcmTokens = [];
                const tokensData = yield fcmToken_model_1.DeviceToken.find({
                    userId: { $in: validUserIds },
                    fcmToken: { $exists: true, $ne: "" },
                })
                    .select("fcmToken")
                    .lean();
                fcmTokens = tokensData.map((t) => t.fcmToken);
                // --- PARALLEL EXECUTION START ---
                const tasks = [];
                // TASK A: Send Push Notifications (only if tokens exist)
                if (fcmTokens.length > 0) {
                    tasks.push(this.sendToFCM(fcmTokens, payload));
                }
                // TASK B: Save to Database
                tasks.push(this.saveToDatabase(validUserIds, payload));
                yield Promise.allSettled(tasks);
                // --- PARALLEL EXECUTION END ---
                logger_1.logger.info(colors_1.default.green(`✅ Notification flow completed. DB save: ${validUserIds.length}, Push: ${validUserIds.length}`));
            }
            catch (error) {
                logger_1.logger.error(colors_1.default.red("❌ NotificationHelper Error:"), error);
            }
        });
    }
    /**
     * 🔒 PRIVATE: Handle Firebase Logic & Token Cleanup
     * Chunks tokens into batches of 500 (Firebase limit)
     */
    sendToFCM(tokens, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // ✅ Fixed: Chunk tokens into batches of 500 (Firebase multicast limit)
                const BATCH_SIZE = 500;
                const chunks = [];
                for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
                    chunks.push(tokens.slice(i, i + BATCH_SIZE));
                }
                for (const chunk of chunks) {
                    const message = {
                        tokens: chunk,
                        notification: {
                            title: payload.title,
                            body: payload.body,
                        },
                        data: payload.data || {},
                    };
                    const response = yield firebase_1.firebaseAdmin
                        .messaging()
                        .sendEachForMulticast(message);
                    // Cleanup Invalid Tokens
                    if (response.failureCount > 0) {
                        const failedTokens = [];
                        response.responses.forEach((resp, idx) => {
                            var _a;
                            if (!resp.success) {
                                const errCode = (_a = resp.error) === null || _a === void 0 ? void 0 : _a.code;
                                if (errCode === "messaging/registration-token-not-registered" ||
                                    errCode === "messaging/mismatched-credential") {
                                    failedTokens.push(chunk[idx]);
                                }
                            }
                        });
                        if (failedTokens.length > 0) {
                            yield fcmToken_model_1.DeviceToken.deleteMany({ fcmToken: { $in: failedTokens } });
                            logger_1.logger.info(colors_1.default.yellow(`🗑️ Cleaned up ${failedTokens.length} invalid tokens.`));
                        }
                    }
                }
            }
            catch (error) {
                logger_1.logger.error(colors_1.default.red("FCM Send Error:"), error);
            }
        });
    }
    /**
     * 🔒 PRIVATE: Handle Database Saving
     */
    saveToDatabase(userIds, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            try {
                const referenceModel = notification_constant_1.NOTIFICATION_REFERENCE_MODELS.includes((_a = payload.data) === null || _a === void 0 ? void 0 : _a.referenceModel)
                    ? (_b = payload.data) === null || _b === void 0 ? void 0 : _b.referenceModel
                    : undefined;
                const referenceId = referenceModel &&
                    ((_c = payload.data) === null || _c === void 0 ? void 0 : _c.referenceId) &&
                    mongoose_1.default.Types.ObjectId.isValid(payload.data.referenceId)
                    ? payload.data.referenceId
                    : undefined;
                const sender = ((_d = payload.data) === null || _d === void 0 ? void 0 : _d.sender) &&
                    mongoose_1.default.Types.ObjectId.isValid(payload.data.sender)
                    ? payload.data.sender
                    : undefined;
                const notifications = userIds.map((userId) => (Object.assign({ receiver: userId, sender, title: payload.title, text: payload.body, type: payload.type, read: false }, (referenceId ? { referenceId, referenceModel } : {}))));
                const createdNotifications = yield notification_model_1.Notification.insertMany(notifications);
                //@ts-ignore
                const socketIo = global.io;
                if (socketIo) {
                    createdNotifications.forEach((notif) => {
                        socketIo.emit(`send-notification::${notif.receiver}`, notif);
                    });
                }
            }
            catch (error) {
                logger_1.logger.error(colors_1.default.red(`DB Save Error (${payload.title}):`), error);
            }
        });
    }
    /**
     * 🔒 PRIVATE: Handle Email Sending
     */
    sendToEmail(users, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const emailTasks = users.map((user) => __awaiter(this, void 0, void 0, function* () {
                    if (!user.email)
                        return;
                    const emailPayload = emailTemplate_1.emailTemplate.genericNotification({
                        to: user.email,
                        subject: payload.title,
                        text: payload.body,
                    });
                    return emailHelper_1.emailHelper.sendEmail(emailPayload);
                }));
                yield Promise.allSettled(emailTasks);
            }
            catch (error) {
                logger_1.logger.error(colors_1.default.red("Email Send Error inside NotificationHelper:"), error);
            }
        });
    }
}
exports.notificationHelper = new NotificationHelper();
