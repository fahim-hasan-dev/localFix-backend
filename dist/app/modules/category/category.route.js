"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoryRoutes = void 0;
const express_1 = __importDefault(require("express"));
const authHelper_1 = require("../../../helpers/authHelper");
const flieUploadHandler_1 = __importDefault(require("../../middlewares/flieUploadHandler"));
const optionalAuth_1 = __importDefault(require("../../middlewares/optionalAuth"));
const parseFileData_1 = require("../../middlewares/parseFileData");
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const category_controller_1 = require("./category.controller");
const category_validation_1 = require("./category.validation");
const router = express_1.default.Router();
const uploadCategoryFiles = [
    (0, flieUploadHandler_1.default)(["coverImage", "icon"]),
    (0, parseFileData_1.parseFileData)({ fieldName: "coverImage", mode: "single" }, { fieldName: "icon", mode: "single" }),
];
router
    .route("/")
    .post(authHelper_1.isAdmin, ...uploadCategoryFiles, (0, validateRequest_1.default)(category_validation_1.CategoryValidation.createCategoryZodSchema), category_controller_1.CategoryController.createCategory)
    .get((0, optionalAuth_1.default)(), category_controller_1.CategoryController.getAllCategories);
router
    .route("/:id")
    .get((0, optionalAuth_1.default)(), category_controller_1.CategoryController.getCategoryById)
    .patch(authHelper_1.isAdmin, ...uploadCategoryFiles, (0, validateRequest_1.default)(category_validation_1.CategoryValidation.updateCategoryZodSchema), category_controller_1.CategoryController.updateCategory)
    .delete(authHelper_1.isAdmin, category_controller_1.CategoryController.deleteCategory);
exports.CategoryRoutes = router;
