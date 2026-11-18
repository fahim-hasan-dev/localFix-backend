"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookRoutes = void 0;
const express_1 = __importDefault(require("express"));
const webhook_controller_1 = require("./webhook.controller");
const checkr_controller_1 = require("../checkr/checkr.controller");
const router = express_1.default.Router();
// Root Stripe Webhook Endpoint (No Auth - Protected via Stripe signature)
router.post("/", webhook_controller_1.WebhookController.handleStripeWebhook);
// Checkr Background Check Webhook Endpoint (/webhook/checkr)
router.post("/checkr", checkr_controller_1.CheckrControllers.handleWebhook);
exports.WebhookRoutes = router;
