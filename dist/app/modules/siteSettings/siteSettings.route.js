"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SiteSettingsRoutes = void 0;
const express_1 = __importDefault(require("express"));
const authHelper_1 = require("../../../helpers/authHelper");
const flieUploadHandler_1 = __importDefault(require("../../middlewares/flieUploadHandler"));
const parseFileData_1 = require("../../middlewares/parseFileData");
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const siteSettings_controller_1 = require("./siteSettings.controller");
const siteSettings_validation_1 = require("./siteSettings.validation");
const router = express_1.default.Router();
router
    .route("/")
    .post(authHelper_1.isAdmin, (0, flieUploadHandler_1.default)(["headerLogo", "footerLogo", "favicon"]), (0, parseFileData_1.parseFileData)({ fieldName: "headerLogo", mode: "single" }, { fieldName: "footerLogo", mode: "single" }, { fieldName: "favicon", mode: "single" }), (0, validateRequest_1.default)(siteSettings_validation_1.SiteSettingsZodValidation.upsertSiteSettingsValidationSchema), siteSettings_controller_1.SiteSettingsController.upsertSiteSettings)
    .get(siteSettings_controller_1.SiteSettingsController.getSiteSettings);
exports.SiteSettingsRoutes = router;
