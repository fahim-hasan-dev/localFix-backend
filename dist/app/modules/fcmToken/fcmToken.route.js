"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FcmTokenRoutes = void 0;
const express_1 = __importDefault(require("express"));
const fcmToken_controller_1 = require("./fcmToken.controller");
const authHelper_1 = require("../../../helpers/authHelper");
const router = express_1.default.Router();
router.post("/save-token", authHelper_1.isAuthenticated, fcmToken_controller_1.FcmTokenController.saveDeviceToken);
exports.FcmTokenRoutes = router;
