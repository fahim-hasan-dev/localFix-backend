"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuotationRoutes = void 0;
const express_1 = __importDefault(require("express"));
const authHelper_1 = require("../../../helpers/authHelper");
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const checkSubscriptionLimit_1 = require("../../middlewares/checkSubscriptionLimit");
const quotation_controller_1 = require("./quotation.controller");
const quotation_validation_1 = require("./quotation.validation");
const jobRequest_controller_1 = require("../jobRequest/jobRequest.controller");
const router = express_1.default.Router();
router
    .route("/")
    .post(authHelper_1.isProfessional, checkSubscriptionLimit_1.checkQuotationLimit, (0, validateRequest_1.default)(quotation_validation_1.QuotationValidation.createQuotationZodSchema), quotation_controller_1.QuotationController.createQuotation)
    .get(authHelper_1.isAuthenticated, quotation_controller_1.QuotationController.getAllQuotations);
router.get("/my-proposals", authHelper_1.isProfessional, jobRequest_controller_1.JobRequestController.getMyProposals);
router.get("/:id", authHelper_1.isAuthenticated, quotation_controller_1.QuotationController.getQuotationById);
router.patch("/:id/accept", authHelper_1.isHomeOwner, (0, validateRequest_1.default)(quotation_validation_1.QuotationValidation.acceptQuotationZodSchema), quotation_controller_1.QuotationController.acceptQuotation);
// Decline quotation using DELETE method
router.delete("/:id/decline", authHelper_1.isHomeOwner, (0, validateRequest_1.default)(quotation_validation_1.QuotationValidation.declineQuotationZodSchema), quotation_controller_1.QuotationController.declineQuotation);
router.delete("/:id/reject", authHelper_1.isHomeOwner, (0, validateRequest_1.default)(quotation_validation_1.QuotationValidation.declineQuotationZodSchema), quotation_controller_1.QuotationController.declineQuotation);
exports.QuotationRoutes = router;
