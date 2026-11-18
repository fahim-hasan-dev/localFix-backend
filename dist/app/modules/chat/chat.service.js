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
exports.ChatService = void 0;
const chat_model_1 = require("./chat.model");
const mongoose_1 = __importDefault(require("mongoose"));
const user_model_1 = require("../user/user.model");
const message_model_1 = require("../message/message.model");
const ApiErrors_1 = __importDefault(require("../../../errors/ApiErrors"));
const message_1 = require("../../../enums/message");
const chat_socket_1 = require("./socket/chat.socket");
const createChatIntoDB = (participants) => __awaiter(void 0, void 0, void 0, function* () {
    // Deduplicate participants to avoid duplicate entries in the array and duplicate socket emissions
    const uniqueParticipants = [
        ...new Set(participants.map((p) => p.toString())),
    ];
    if (uniqueParticipants.length < 2) {
        throw new ApiErrors_1.default(400, "Chat requires at least two distinct participants.");
    }
    const query = {
        participants: {
            $size: uniqueParticipants.length,
            $all: uniqueParticipants,
        },
        isDeleted: { $ne: true },
    };
    const isExistChat = yield chat_model_1.Chat.findOne(query);
    if (isExistChat) {
        // If the chat was previously soft-deleted by this user, restore it
        if (isExistChat.deletedBy && isExistChat.deletedBy.length > 0) {
            yield chat_model_1.Chat.findByIdAndUpdate(isExistChat._id, {
                $pull: { deletedBy: { $in: uniqueParticipants } },
                isDeleted: false,
            });
        }
        return isExistChat;
    }
    const newChat = yield chat_model_1.Chat.create({
        participants: uniqueParticipants,
        lastMessage: null,
    });
    if (!newChat) {
        throw new ApiErrors_1.default(500, "Failed to create chat");
    }
    uniqueParticipants.forEach((participant) => {
        chat_socket_1.chatSocketHelper.emitNewChat(participant, newChat);
    });
    return newChat;
});
const markChatAsRead = (userId, chatId) => __awaiter(void 0, void 0, void 0, function* () {
    const chat = yield chat_model_1.Chat.findById(chatId);
    if (!chat) {
        throw new ApiErrors_1.default(404, "Chat not found");
    }
    const isParticipant = chat.participants.some((p) => p.toString() === userId.toString());
    if (!isParticipant) {
        throw new ApiErrors_1.default(403, "You are not a participant in this chat");
    }
    const result = yield chat_model_1.Chat.findByIdAndUpdate(chatId, { $addToSet: { readBy: userId } }, { new: true }).lean();
    // Mark all messages in this chat from other participants as read
    yield message_model_1.Message.updateMany({
        chatId,
        sender: { $ne: userId },
        read: false,
    }, {
        $set: { read: true, readAt: new Date() },
    });
    // Emit socket notification to update the unread count/state
    chat_socket_1.chatSocketHelper.emitUnreadCountUpdate(userId, {
        chatId,
        action: "read",
    });
    chat.participants.forEach((participant) => {
        const participantId = participant.toString();
        if (participantId === userId.toString())
            return;
        chat_socket_1.chatSocketHelper.emitUnreadCountUpdate(participantId, {
            chatId,
            action: "seen",
        });
    });
    if (result) {
        return Object.assign(Object.assign({}, result), { read: true, isRead: true, unreadCount: 0 });
    }
    return result;
});
const enrichChatsWithUnreadCount = (rawChats, userId) => __awaiter(void 0, void 0, void 0, function* () {
    const userObjectId = new mongoose_1.default.Types.ObjectId(userId);
    return Promise.all(rawChats.map((chat) => __awaiter(void 0, void 0, void 0, function* () {
        const otherParticipantIds = chat.participants.filter((participantId) => participantId && participantId.toString() !== userId.toString());
        const otherParticipants = yield user_model_1.User.find({
            _id: { $in: otherParticipantIds },
        })
            .select("_id name profileImage email role companyName phone")
            .lean();
        const unreadCount = yield message_model_1.Message.countDocuments({
            chatId: chat._id,
            sender: { $ne: userObjectId },
            read: false,
            isDeleted: false,
        });
        return Object.assign(Object.assign({}, chat), { participants: otherParticipants, read: unreadCount === 0, isRead: unreadCount === 0, unreadCount });
    })));
});
const getAllChatsFromDB = (userId, query) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const searchTerm = (_a = query.searchTerm) === null || _a === void 0 ? void 0 : _a.toLowerCase();
    const page = Math.max(parseInt(query.page) || 1, 1);
    const limit = Math.max(parseInt(query.limit) || 10, 1);
    const skip = (page - 1) * limit;
    const userObjectId = new mongoose_1.default.Types.ObjectId(userId);
    const chatQuery = {
        participants: { $in: [userObjectId] },
        deletedBy: { $ne: userObjectId },
        isDeleted: { $ne: true },
    };
    let chats;
    let totalChats;
    let unreadChatsCount = 0;
    let totalUnreadMessages = 0;
    if (searchTerm) {
        const allChats = yield chat_model_1.Chat.find(chatQuery)
            .populate({
            path: "lastMessage",
            populate: {
                path: "sender",
                select: "_id name profileImage email role companyName",
            },
        })
            .lean()
            .sort({ updatedAt: -1 });
        const allChatLists = yield enrichChatsWithUnreadCount(allChats, userId);
        const filteredChats = allChatLists.filter((chat) => chat.participants.some((participant) => participant.name &&
            participant.name.toLowerCase().includes(searchTerm)));
        totalChats = filteredChats.length;
        unreadChatsCount = filteredChats.filter((chat) => chat.unreadCount > 0).length;
        totalUnreadMessages = filteredChats.reduce((total, chat) => total + chat.unreadCount, 0);
        chats = filteredChats.slice(skip, skip + limit);
    }
    else {
        totalChats = yield chat_model_1.Chat.countDocuments(chatQuery);
        const rawChats = yield chat_model_1.Chat.find(chatQuery)
            .populate({
            path: "lastMessage",
            populate: {
                path: "sender",
                select: "_id name profileImage email role companyName",
            },
        })
            .lean()
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(limit);
        chats = yield enrichChatsWithUnreadCount(rawChats, userId);
        const allChatIds = yield chat_model_1.Chat.find(chatQuery).distinct("_id");
        if (allChatIds.length > 0) {
            const unreadSummary = yield message_model_1.Message.aggregate([
                {
                    $match: {
                        chatId: { $in: allChatIds },
                        sender: { $ne: userObjectId },
                        read: false,
                        isDeleted: false,
                    },
                },
                {
                    $group: {
                        _id: "$chatId",
                        count: { $sum: 1 },
                    },
                },
            ]);
            unreadChatsCount = unreadSummary.length;
            totalUnreadMessages = unreadSummary.reduce((total, item) => total + item.count, 0);
        }
    }
    const totalPage = Math.ceil(totalChats / limit);
    return {
        data: chats,
        unreadChatsCount,
        totalUnreadMessages,
        meta: {
            limit,
            page,
            total: totalChats,
            totalPage,
        },
    };
});
const getChatImagesFromDB = (chatId, userId) => __awaiter(void 0, void 0, void 0, function* () {
    // check chat existence
    const chat = yield chat_model_1.Chat.findById(chatId);
    if (!chat) {
        throw new ApiErrors_1.default(404, "Chat not found");
    }
    // verify user is participant
    const isParticipant = chat.participants.some((p) => p.toString() === userId.toString());
    if (!isParticipant) {
        throw new ApiErrors_1.default(403, "You are not a participant in this chat");
    }
    // ========================GET IMAGES DATA=======================
    // Return all images in this chat sent by any participant
    const images = yield message_model_1.Message.find({
        chatId,
        isDeleted: { $ne: true },
        $or: [{ type: message_1.MESSAGE_TYPE.IMAGE }, { type: message_1.MESSAGE_TYPE.BOTH }],
    })
        .sort({ createdAt: -1 })
        .select("image -_id")
        .lean();
    // return only image URLs as array
    return images.map((msg) => msg.image).filter(Boolean);
});
const softDeleteChatForUser = (chatId, id) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = new mongoose_1.default.Types.ObjectId(id);
    const chat = yield chat_model_1.Chat.findById(chatId);
    if (!chat) {
        throw new ApiErrors_1.default(404, "Chat not found");
    }
    if (!chat.participants.some((id) => id.toString() === userId.toString())) {
        throw new ApiErrors_1.default(401, "User is not authorized");
    }
    // If already deleted by this user, just return
    if (chat.deletedBy.some((id) => id.toString() === userId.toString())) {
        return chat;
    }
    // Add userId to deletedBy array
    chat.deletedBy.push(userId);
    // If all participants deleted, mark status deleted (soft delete for everyone)
    if (chat.deletedBy.length === chat.participants.length) {
        chat.isDeleted = true;
    }
    yield chat.save();
    chat.participants.forEach((participant) => {
        chat_socket_1.chatSocketHelper.emitChatDeleted(participant.toString(), {
            chatId,
            userId,
        });
    });
    return chat;
});
exports.ChatService = {
    createChatIntoDB,
    getAllChatsFromDB,
    markChatAsRead,
    softDeleteChatForUser,
    getChatImagesFromDB,
};
