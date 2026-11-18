"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatSocketHelper = void 0;
const socketHelper_1 = require("../../../../helpers/socketHelper");
const emitNewChat = (userId, data) => {
    return socketHelper_1.socketHelper.sendToUser(userId, `newChat::${userId}`, data);
};
const emitChatDeleted = (userId, data) => {
    return socketHelper_1.socketHelper.sendToUser(userId, `chatDeletedForUser::${userId}`, data);
};
const emitNewMessage = (userId, data) => {
    return socketHelper_1.socketHelper.sendToUser(userId, `newMessage::${userId}`, data);
};
const emitUnreadCountUpdate = (userId, data) => {
    return socketHelper_1.socketHelper.sendToUser(userId, `unreadCountUpdate::${userId}`, data);
};
const emitChatListUpdate = (userId, data) => {
    return socketHelper_1.socketHelper.sendToUser(userId, `chatListUpdate::${userId}`, data);
};
const emitMessagePinned = (userId, data) => {
    return socketHelper_1.socketHelper.sendToUser(userId, `messagePinned::${userId}`, data);
};
const emitMessageUnpinned = (userId, data) => {
    return socketHelper_1.socketHelper.sendToUser(userId, `messageUnpinned::${userId}`, data);
};
exports.chatSocketHelper = {
    emitNewChat,
    emitChatDeleted,
    emitNewMessage,
    emitUnreadCountUpdate,
    emitChatListUpdate,
    emitMessagePinned,
    emitMessageUnpinned,
};
