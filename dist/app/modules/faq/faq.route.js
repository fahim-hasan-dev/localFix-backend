"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FaqRoutes = void 0;
const express_1 = __importDefault(require("express"));
const faq_controller_1 = require("./faq.controller");
const authHelper_1 = require("../../../helpers/authHelper");
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const faq_validation_1 = require("./faq.validation");
const router = express_1.default.Router();
router
    .route("/")
    .post(authHelper_1.isAdmin, (0, validateRequest_1.default)(faq_validation_1.FaqValidation.createFaqZodSchema), faq_controller_1.FaqController.createFaq)
    .get(faq_controller_1.FaqController.getFaqs);
router
    .route("/:id")
    .get(faq_controller_1.FaqController.getFaqById)
    .patch(authHelper_1.isAdmin, (0, validateRequest_1.default)(faq_validation_1.FaqValidation.updateFaqZodSchema), faq_controller_1.FaqController.updateFaq)
    .delete(authHelper_1.isAdmin, faq_controller_1.FaqController.deleteFaq);
exports.FaqRoutes = router;
