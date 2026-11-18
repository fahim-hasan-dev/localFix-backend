"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageRoutes = void 0;
const express_1 = __importDefault(require("express"));
const message_controller_1 = require("./message.controller");
const files_1 = require("../../../enums/files");
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const message_validation_1 = require("./message.validation");
const parseFileData_1 = require("../../middlewares/parseFileData");
const flieUploadHandler_1 = __importDefault(require("../../middlewares/flieUploadHandler"));
const authHelper_1 = require("../../../helpers/authHelper");
const router = express_1.default.Router();
// Existing routes
router.post("/send-message/:chatId", authHelper_1.isAuthenticated, (0, flieUploadHandler_1.default)(), (0, parseFileData_1.parseFileData)({ fieldName: files_1.FOLDER_NAMES.IMAGE, mode: "single" }), (0, validateRequest_1.default)(message_validation_1.messageValidation.sendMessageValidationSchema), message_controller_1.MessageController.sendMessage);
router.get("/:chatId", authHelper_1.isAuthenticated, message_controller_1.MessageController.getMessages);
router.delete("/delete/:messageId", authHelper_1.isAuthenticated, message_controller_1.MessageController.deleteMessage);
// New route for pin/unpin message
router.patch("/pin-unpin/:messageId", authHelper_1.isAuthenticated, (0, validateRequest_1.default)(message_validation_1.messageValidation.pinUnpinMessageValidationSchema), message_controller_1.MessageController.pinUnpinMessage);
exports.MessageRoutes = router;
