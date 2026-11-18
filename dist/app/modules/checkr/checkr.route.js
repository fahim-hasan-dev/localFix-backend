"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckrRoutes = void 0;
const express_1 = __importDefault(require("express"));
const checkr_controller_1 = require("./checkr.controller");
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const checkr_validation_1 = require("./checkr.validation");
const authHelper_1 = require("../../../helpers/authHelper");
const router = express_1.default.Router();
// Public Webhook route (authenticated cryptographically via x-checkr-signature)
router.post("/webhook", checkr_controller_1.CheckrControllers.handleWebhook);
// Pre-signup screening link generator (for "Start on Checkr" before final submit)
router.post("/start-screening", (0, validateRequest_1.default)(checkr_validation_1.CheckrValidation.startScreeningZodSchema), checkr_controller_1.CheckrControllers.startPreSignupScreening);
// Authenticated Professional routes
router.post("/initiate", authHelper_1.isProfessional, (0, validateRequest_1.default)(checkr_validation_1.CheckrValidation.initiateBackgroundCheckZodSchema), checkr_controller_1.CheckrControllers.initiateBackgroundCheck);
router.get("/status", authHelper_1.isProfessional, checkr_controller_1.CheckrControllers.getMyBackgroundCheckStatus);
// Admin status check / sync route
router.get("/status/:userId", authHelper_1.isAdmin, checkr_controller_1.CheckrControllers.getUserBackgroundCheckStatus);
exports.CheckrRoutes = router;
