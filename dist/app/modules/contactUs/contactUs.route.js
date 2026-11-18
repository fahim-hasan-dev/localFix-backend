"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContactUsRoutes = void 0;
const express_1 = __importDefault(require("express"));
const contactUs_controller_1 = require("./contactUs.controller");
const authHelper_1 = require("../../../helpers/authHelper");
const optionalAuth_1 = __importDefault(require("../../middlewares/optionalAuth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const contactUs_validation_1 = require("./contactUs.validation");
const router = express_1.default.Router();
router
    .route("/")
    .post((0, optionalAuth_1.default)(), (0, validateRequest_1.default)(contactUs_validation_1.ContactUsValidation.createContactUsZodSchema), contactUs_controller_1.ContactUsControllers.submitContactUs)
    .get(authHelper_1.isAdmin, contactUs_controller_1.ContactUsControllers.getAllContactUs);
router
    .route("/:id")
    .get(authHelper_1.isAdmin, contactUs_controller_1.ContactUsControllers.getContactUsById)
    .patch(authHelper_1.isAdmin, (0, validateRequest_1.default)(contactUs_validation_1.ContactUsValidation.updateContactUsStatusZodSchema), contactUs_controller_1.ContactUsControllers.updateContactUsStatus)
    .delete(authHelper_1.isAdmin, contactUs_controller_1.ContactUsControllers.deleteContactUsById);
exports.ContactUsRoutes = router;
