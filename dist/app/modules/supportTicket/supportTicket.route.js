"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupportTicketRoutes = void 0;
const express_1 = __importDefault(require("express"));
const authHelper_1 = require("../../../helpers/authHelper");
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const supportTicket_controller_1 = require("./supportTicket.controller");
const supportTicket_validation_1 = require("./supportTicket.validation");
const router = express_1.default.Router();
router
    .route("/")
    .post(authHelper_1.isAuthenticated, (0, validateRequest_1.default)(supportTicket_validation_1.SupportTicketValidation.createSupportTicketZodSchema), supportTicket_controller_1.SupportTicketControllers.createSupportTicket)
    .get(authHelper_1.isAuthenticated, supportTicket_controller_1.SupportTicketControllers.getAllSupportTickets);
router.get("/stats", authHelper_1.isAdmin, supportTicket_controller_1.SupportTicketControllers.getSupportTicketStats);
router
    .route("/:id")
    .get(authHelper_1.isAuthenticated, supportTicket_controller_1.SupportTicketControllers.getSupportTicketById)
    .patch(authHelper_1.isAdmin, (0, validateRequest_1.default)(supportTicket_validation_1.SupportTicketValidation.updateSupportTicketZodSchema), supportTicket_controller_1.SupportTicketControllers.updateSupportTicket)
    .delete(authHelper_1.isAdmin, supportTicket_controller_1.SupportTicketControllers.deleteSupportTicket);
router.post("/:id/reply", authHelper_1.isAuthenticated, (0, validateRequest_1.default)(supportTicket_validation_1.SupportTicketValidation.addReplyZodSchema), supportTicket_controller_1.SupportTicketControllers.addReplyToTicket);
exports.SupportTicketRoutes = router;
