"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PackageRoutes = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const user_1 = require("../../../enums/user");
const package_controller_1 = require("./package.controller");
const package_validation_1 = require("./package.validation");
const router = express_1.default.Router();
router
    .route("/")
    .post((0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), (0, validateRequest_1.default)(package_validation_1.PackageValidation.createPackageZodSchema), package_controller_1.PackageController.createPackage)
    .get(package_controller_1.PackageController.getAllPackages);
router
    .route("/:id")
    .get(package_controller_1.PackageController.getPackageById)
    .patch((0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), (0, validateRequest_1.default)(package_validation_1.PackageValidation.updatePackageZodSchema), package_controller_1.PackageController.updatePackage)
    .delete((0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), package_controller_1.PackageController.deletePackage);
exports.PackageRoutes = router;
