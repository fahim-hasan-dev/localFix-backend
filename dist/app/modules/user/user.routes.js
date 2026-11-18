"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRoutes = void 0;
const express_1 = __importDefault(require("express"));
const user_controller_1 = require("./user.controller");
const user_validation_1 = require("./user.validation");
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const parseFileData_1 = require("../../middlewares/parseFileData");
const authHelper_1 = require("../../../helpers/authHelper");
const flieUploadHandler_1 = __importDefault(require("../../middlewares/flieUploadHandler"));
const router = express_1.default.Router();
const userFileUpload = (0, flieUploadHandler_1.default)([
    "profileImage",
    "tradeLicense",
    "tradeLicenseCertificate",
    "coiCertificate",
    "insuranceCertificate",
]);
const userParseFiles = (0, parseFileData_1.parseFileData)({ fieldName: "profileImage", mode: "single" }, { fieldName: "tradeLicense", mode: "single" }, { fieldName: "tradeLicenseCertificate", mode: "single" }, { fieldName: "coiCertificate", mode: "single" }, { fieldName: "insuranceCertificate", mode: "single" });
const projectPhotoUpload = (0, flieUploadHandler_1.default)(["projectPhoto", "image"]);
const projectPhotoParseFiles = (0, parseFileData_1.parseFileData)({ fieldName: "projectPhoto", mode: "single" }, { fieldName: "image", mode: "single" });
/* ---------------------------- PROFILE ROUTES ---------------------------- */
router
    .route("/profile")
    .get(authHelper_1.isAuthenticated, user_controller_1.UserController.getMyProfile)
    .patch(authHelper_1.isAuthenticated, userFileUpload, userParseFiles, (0, validateRequest_1.default)(user_validation_1.UserValidation.updateProfileZodSchema), user_controller_1.UserController.updateProfile)
    .delete(authHelper_1.isAuthenticated, user_controller_1.UserController.deleteProfile);
/* ---------------------------- PROJECT PHOTOS (PROFESSIONAL) ------------- */
router.post("/profile/project-photos", authHelper_1.isProfessional, projectPhotoUpload, projectPhotoParseFiles, (0, validateRequest_1.default)(user_validation_1.UserValidation.addProjectPhotoZodSchema), user_controller_1.UserController.addProjectPhoto);
router
    .route("/profile/project-photos/:photoId")
    .patch(authHelper_1.isProfessional, projectPhotoUpload, projectPhotoParseFiles, (0, validateRequest_1.default)(user_validation_1.UserValidation.updateProjectPhotoZodSchema), user_controller_1.UserController.updateProjectPhoto)
    .delete(authHelper_1.isProfessional, user_controller_1.UserController.deleteProjectPhoto);
/* ---------------------------- SUPER ADMIN ------------------------------- */
router.get("/super-admin", user_controller_1.UserController.getSuperAdmin);
/* ---------------------------- ADMIN CREATE ------------------------------ */
router.post("/create-admin", authHelper_1.isSuperAdmin, (0, validateRequest_1.default)(user_validation_1.UserValidation.createAdminZodSchema), user_controller_1.UserController.createAdmin);
/* ---------------------------- ADMINS LIST ------------------------------- */
router.get("/admins", authHelper_1.isSuperAdmin, user_controller_1.UserController.getAdmin);
router.delete("/admins/:id", authHelper_1.isSuperAdmin, user_controller_1.UserController.deleteAdmin);
/* ---------------------------- USER CREATE & LIST ------------------------ */
router
    .route("/")
    .get(authHelper_1.isAdmin, user_controller_1.UserController.getUsers)
    .post(userFileUpload, userParseFiles, (0, validateRequest_1.default)(user_validation_1.UserValidation.createUserZodSchema), user_controller_1.UserController.createUser)
    .patch(authHelper_1.isAuthenticated, userFileUpload, userParseFiles, (0, validateRequest_1.default)(user_validation_1.UserValidation.updateProfileZodSchema), user_controller_1.UserController.updateProfile);
/* ---------------------------- CLEARANCE & VERIFICATION ----------------- */
router.get("/clearances", authHelper_1.isAdmin, user_controller_1.UserController.getClearances);
router.get("/clearance", authHelper_1.isAdmin, user_controller_1.UserController.getClearances);
router.get("/clearances/:id", authHelper_1.isAdmin, user_controller_1.UserController.getUserById);
router.get("/clearance/:id", authHelper_1.isAdmin, user_controller_1.UserController.getUserById);
/* ---------------------------- STATUS UPDATE ----------------------------- */
router.patch("/admin/status/:id", authHelper_1.isAdmin, user_controller_1.UserController.updateAdminStatusById);
router.patch("/status/:id", authHelper_1.isAdmin, (0, validateRequest_1.default)(user_validation_1.UserValidation.updateUserStatusZodSchema), user_controller_1.UserController.updateUserStatusById);
router.patch("/approval-status/:id", authHelper_1.isAdmin, (0, validateRequest_1.default)(user_validation_1.UserValidation.updateApprovalStatusZodSchema), user_controller_1.UserController.updateApprovalStatusById);
/* ---------------------------- DYNAMIC USER ID ROUTES (KEEP LAST!) ------- */
router
    .route("/:id")
    .get(authHelper_1.isAdmin, user_controller_1.UserController.getUserById)
    .delete(authHelper_1.isAdmin, user_controller_1.UserController.deleteUserById);
exports.UserRoutes = router;
