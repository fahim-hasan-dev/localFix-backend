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
exports.chatPermissionHelper = exports.checkChatPermission = void 0;
const user_model_1 = require("../../user/user.model");
const user_1 = require("../../../../enums/user");
const VALID_CHAT_ROLES = [
    user_1.USER_ROLES.ADMIN,
    user_1.USER_ROLES.SUPER_ADMIN,
    user_1.USER_ROLES.HOME_OWNER,
    user_1.USER_ROLES.PROFESSIONAL,
];
/**
 * Centrally validates if chat communication is allowed between sender and receiver.
 */
const checkChatPermission = (senderId, receiverId) => __awaiter(void 0, void 0, void 0, function* () {
    const sender = yield user_model_1.User.findById(senderId);
    const receiver = yield user_model_1.User.findById(receiverId);
    // 0. Verify sender is not receiver (prevent self-chat)
    if (senderId.toString() === receiverId.toString()) {
        return {
            allowed: false,
            reason: "You cannot create a chat with yourself.",
        };
    }
    // 1. Verify user exists
    if (!sender) {
        return { allowed: false, reason: "Sender user account not found." };
    }
    if (!receiver) {
        return { allowed: false, reason: "Receiver user account not found." };
    }
    // 2. Verify blocked status (User status)
    if (sender.status === user_1.STATUS.INACTIVE) {
        return {
            allowed: false,
            reason: "Sender is currently suspended or inactive.",
        };
    }
    if (receiver.status === user_1.STATUS.INACTIVE) {
        return { allowed: false, reason: "Receiver user is blocked or suspended." };
    }
    // 3. Verify valid project roles
    if (!VALID_CHAT_ROLES.includes(sender.role) ||
        !VALID_CHAT_ROLES.includes(receiver.role)) {
        return {
            allowed: false,
            reason: "Invalid user role for chat communication.",
        };
    }
    return { allowed: true, reason: "Allowed" };
});
exports.checkChatPermission = checkChatPermission;
exports.chatPermissionHelper = {
    checkChatPermission: exports.checkChatPermission,
};
