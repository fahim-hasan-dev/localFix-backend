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
exports.MessageService = void 0;
const ApiErrors_1 = __importDefault(require("../../../errors/ApiErrors"));
const chat_model_1 = require("../chat/chat.model");
const message_model_1 = require("./message.model");
const chat_socket_1 = require("../chat/socket/chat.socket");
const chatPermission_helper_1 = require("../chat/helpers/chatPermission.helper");
const message_1 = require("../../../enums/message");
const detectMessageType = (payload) => {
    const hasText = !!payload.text && payload.text.trim().length > 0;
    const hasImage = payload.image;
    if (hasText && hasImage)
        return message_1.MESSAGE_TYPE.BOTH;
    if (hasText)
        return message_1.MESSAGE_TYPE.TEXT;
    if (hasImage)
        return message_1.MESSAGE_TYPE.IMAGE;
    return message_1.MESSAGE_TYPE.DOC;
};
// enhanced version with better error handling and logging
const sendMessageToDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    // check if chat exists
    const chat = yield chat_model_1.Chat.findById(payload.chatId);
    if (!chat) {
        throw new ApiErrors_1.default(404, "Chat not found");
    }
    // verify sender is participant
    const isSenderParticipant = chat.participants.some((p) => p.toString() === payload.sender.toString());
    if (!isSenderParticipant) {
        throw new ApiErrors_1.default(403, "Sender is not a participant in this chat");
    }
    const receiverId = chat.participants.find((p) => p.toString() !== payload.sender.toString());
    if (receiverId) {
        const permission = yield chatPermission_helper_1.chatPermissionHelper.checkChatPermission(payload.sender, receiverId);
        if (!permission.allowed) {
            throw new ApiErrors_1.default(403, `Cannot send message: ${permission.reason}`);
        }
    }
    // create message with proper defaults
    const messagePayload = Object.assign(Object.assign({}, payload), { type: detectMessageType(payload), read: false, readAt: null, isDeleted: false, createdAt: new Date() });
    const response = yield message_model_1.Message.create(messagePayload);
    // update chat - remove ALL participants from readBy except sender
    // and unhide the chat if any participant had soft-deleted it
    yield chat_model_1.Chat.findByIdAndUpdate(response === null || response === void 0 ? void 0 : response.chatId, {
        lastMessage: response._id,
        readBy: [payload.sender.toString()], // Only sender has read it
        $pull: { deletedBy: { $in: chat.participants } },
        isDeleted: false,
        updatedAt: new Date(),
    }, { new: true });
    // get populated message for socket
    const populatedMessage = yield message_model_1.Message.findById(response._id)
        .populate("sender", "name role email profileImage")
        .lean();
    // get updated chat with populated data for chat list update
    const populatedChat = yield chat_model_1.Chat.findById(response === null || response === void 0 ? void 0 : response.chatId)
        .populate("participants", "name role email profileImage")
        .populate("lastMessage")
        .lean();
    if (chat.participants) {
        const otherParticipants = chat.participants.filter((participant) => participant && participant.toString() !== payload.sender.toString());
        // Deduplicate recipient IDs to ensure socket events are only sent once per unique user
        const uniqueOtherParticipants = [
            ...new Set(otherParticipants.map((p) => p.toString())),
        ];
        // emit to each participant
        uniqueOtherParticipants.forEach((participantIdStr) => {
            // emit new message
            chat_socket_1.chatSocketHelper.emitNewMessage(participantIdStr, populatedMessage);
            // emit unread count update - let frontend handle the increment
            chat_socket_1.chatSocketHelper.emitUnreadCountUpdate(participantIdStr, {
                chatId: payload.chatId,
                action: "increment",
            });
            // emit chat list update to move this chat to top
            chat_socket_1.chatSocketHelper.emitChatListUpdate(participantIdStr, {
                chatId: payload.chatId,
                chat: populatedChat,
                action: "moveToTop",
                lastMessage: populatedMessage,
                updatedAt: new Date(),
            });
        });
        // also emit chat list update to sender (to update their own chat list)
        const senderIdStr = payload.sender.toString();
        chat_socket_1.chatSocketHelper.emitChatListUpdate(senderIdStr, {
            chatId: payload.chatId,
            chat: populatedChat,
            action: "moveToTop",
            lastMessage: populatedMessage,
            updatedAt: new Date(),
        });
    }
    return response;
});
const getMessagesFromDB = (chatId, userId, // Add userId parameter
query) => __awaiter(void 0, void 0, void 0, function* () {
    // Check chat existence and participant authorization
    const chat = yield chat_model_1.Chat.findById(chatId);
    if (!chat) {
        throw new ApiErrors_1.default(404, "Chat not found");
    }
    const isParticipant = chat.participants.some((p) => p.toString() === userId.toString());
    if (!isParticipant) {
        throw new ApiErrors_1.default(403, "You are not authorized to view messages in this chat");
    }
    const { page, limit } = query;
    const pageInt = Math.max(parseInt(String(page || "1"), 10) || 1, 1);
    const limitInt = Math.min(Math.max(parseInt(String(limit || "10"), 10) || 10, 1), 100);
    const skip = (pageInt - 1) * limitInt;
    const total = yield message_model_1.Message.countDocuments({ chatId });
    const response = yield message_model_1.Message.find({ chatId })
        .populate({
        path: "sender",
        select: "name role email profileImage companyName",
    })
        .populate({
        path: "pinnedBy",
        select: "name role email profileImage companyName",
    })
        .skip(skip)
        .limit(limitInt)
        .sort({ createdAt: -1 });
    // Mark messages as read for the current user (only messages not sent by current user)
    const messageIds = response
        .filter((msg) => msg.sender._id.toString() !== userId && !msg.read)
        .map((msg) => msg._id);
    if (messageIds.length > 0) {
        yield message_model_1.Message.updateMany({
            _id: { $in: messageIds },
            sender: { $ne: userId }, // Only update messages not sent by current user
        }, {
            $set: { read: true, readAt: new Date() },
        });
    }
    // Get pinned messages separately
    const pinnedMessages = yield message_model_1.Message.find({
        chatId,
        isPinned: true,
        isDeleted: false,
    })
        .populate({
        path: "sender",
        select: "name role email profileImage companyName",
    })
        .populate({
        path: "pinnedBy",
        select: "name role email profileImage companyName",
    })
        .sort({ pinnedAt: -1 });
    const formattedMessages = response.map((message) => {
        const senderId = message.sender && typeof message.sender === "object" && "_id" in message.sender
            ? message.sender._id.toString()
            : String(message.sender);
        const mine = senderId === userId.toString();
        return Object.assign(Object.assign({}, message.toObject()), { isDeleted: message.isDeleted, text: message.isDeleted ? "This message has been deleted." : message.text, 
            // Incoming messages were just marked read for this viewer.
            // Outgoing messages stay unread until the other person opens the chat.
            read: mine ? Boolean(message.read) : true });
    });
    const formattedPinnedMessages = pinnedMessages.map((message) => (Object.assign(Object.assign({}, message.toObject()), { text: message.isDeleted ? "This message has been deleted." : message.text })));
    const totalPage = Math.ceil(total / limitInt);
    return {
        messages: formattedMessages,
        pinnedMessages: formattedPinnedMessages,
        pagination: {
            total,
            page: pageInt,
            limit: limitInt,
            totalPage,
        },
    };
});
const deleteMessage = (userId, messageId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Find the message by messageId
        const message = yield message_model_1.Message.findById(messageId);
        if (!message) {
            throw new ApiErrors_1.default(404, "Message not found");
        }
        // Ensure the user is the sender of the message
        if (message.sender.toString() !== userId.toString()) {
            throw new ApiErrors_1.default(403, "You can only delete your own messages");
        }
        const updateMessage = yield message_model_1.Message.findByIdAndUpdate(message._id, {
            $set: {
                isDeleted: true,
                isPinned: false, // unpin message when deleted
                pinnedBy: undefined,
                pinnedAt: undefined,
            },
        }, { new: true });
        // if message was pinned, also remove from chat's pinnedMessages
        if (message.isPinned) {
            yield chat_model_1.Chat.findByIdAndUpdate(message.chatId, {
                $pull: { pinnedMessages: messageId },
            });
        }
        return updateMessage;
    }
    catch (error) {
        console.error("Error deleting message:", error);
        throw new ApiErrors_1.default(500, "Internal server error");
    }
});
// new feature: Pin/Unpin message
const pinUnpinMessage = (userId, messageId, action) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const message = yield message_model_1.Message.findById(messageId);
        if (!message) {
            throw new ApiErrors_1.default(404, "Message not found");
        }
        // check if user is participant in the chat
        const chat = yield chat_model_1.Chat.findById(message.chatId);
        if (!chat || !chat.participants.some((p) => p.toString() === userId)) {
            throw new ApiErrors_1.default(403, "You are not authorized to pin messages in this chat");
        }
        if (action === "pin") {
            // check if message is already pinned
            if (message.isPinned) {
                throw new ApiErrors_1.default(400, "Message is already pinned");
            }
            // check pinned messages limit (optional - limit to 10 pinned messages per chat)
            const pinnedCount = yield message_model_1.Message.countDocuments({
                chatId: message.chatId,
                isPinned: true,
                isDeleted: false,
            });
            if (pinnedCount >= 10) {
                throw new ApiErrors_1.default(400, "Maximum 10 messages can be pinned per chat");
            }
            // Pin the message
            const updatedMessage = yield message_model_1.Message.findByIdAndUpdate(messageId, {
                $set: {
                    isPinned: true,
                    pinnedBy: userId,
                    pinnedAt: new Date(),
                },
            }, { new: true });
            // Add to chat's pinnedMessages array
            yield chat_model_1.Chat.findByIdAndUpdate(message.chatId, {
                $addToSet: { pinnedMessages: messageId },
            });
            // Notify all participants
            chat.participants.forEach((participantId) => {
                chat_socket_1.chatSocketHelper.emitMessagePinned(participantId.toString(), {
                    messageId,
                    chatId: message.chatId,
                    pinnedBy: userId,
                    message: updatedMessage,
                });
            });
            return updatedMessage;
        }
        else {
            // unpin the message
            if (!message.isPinned) {
                throw new ApiErrors_1.default(400, "Message is not pinned");
            }
            const updatedMessage = yield message_model_1.Message.findByIdAndUpdate(messageId, {
                $set: {
                    isPinned: false,
                    pinnedBy: undefined,
                    pinnedAt: undefined,
                },
            }, { new: true });
            //
            // Remove from chat's pinnedMessages array
            yield chat_model_1.Chat.findByIdAndUpdate(message.chatId, {
                $pull: { pinnedMessages: messageId },
            });
            // Notify all participants
            chat.participants.forEach((participantId) => {
                chat_socket_1.chatSocketHelper.emitMessageUnpinned(participantId.toString(), {
                    messageId,
                    chatId: message.chatId,
                    unpinnedBy: userId,
                });
            });
            return updatedMessage;
        }
    }
    catch (error) {
        console.error("Error pinning/unpinning message:", error);
        throw new ApiErrors_1.default(500, "Internal server error");
    }
});
exports.MessageService = {
    sendMessageToDB,
    getMessagesFromDB,
    deleteMessage,
    pinUnpinMessage,
};
