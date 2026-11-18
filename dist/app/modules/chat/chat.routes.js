"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatRoutes = void 0;
const express_1 = require("express");
const chat_controller_1 = require("./chat.controller");
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const chat_validation_1 = require("./chat.validation");
const authHelper_1 = require("../../../helpers/authHelper");
const router = (0, express_1.Router)();
router.get("/", authHelper_1.isAuthenticated, chat_controller_1.ChatController.getChats);
router.get("/:chatId/images", authHelper_1.isAuthenticated, chat_controller_1.ChatController.getChatImages);
router.post("/create-chat", authHelper_1.isAuthenticated, (0, validateRequest_1.default)(chat_validation_1.chatValidation.createChatValidationSchema), chat_controller_1.ChatController.createChat);
router.patch("/mark-chat-as-read/:id", authHelper_1.isAuthenticated, chat_controller_1.ChatController.markChatAsRead);
router.delete("/delete/:chatId", authHelper_1.isAuthenticated, chat_controller_1.ChatController.deleteChat);
exports.ChatRoutes = router;
