"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthRoutes = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const flieUploadHandler_1 = __importDefault(require("../../middlewares/flieUploadHandler"));
const parseFileData_1 = require("../../middlewares/parseFileData");
const auth_controller_1 = require("./auth.controller");
const auth_validation_1 = require("./auth.validation");
const user_1 = require("../../../enums/user");
const router = express_1.default.Router();
const signupFileUpload = (0, flieUploadHandler_1.default)([
    "profileImage",
    "tradeLicense",
    "tradeLicenseCertificate",
    "coiCertificate",
    "insuranceCertificate",
]);
const signupParseFiles = (0, parseFileData_1.parseFileData)({ fieldName: "profileImage", mode: "single" }, { fieldName: "tradeLicense", mode: "single" }, { fieldName: "tradeLicenseCertificate", mode: "single" }, { fieldName: "coiCertificate", mode: "single" }, { fieldName: "insuranceCertificate", mode: "single" });
/* ---------------------------- SIGNUP / REGISTER ---------------------------- */
router.post("/signup", signupFileUpload, signupParseFiles, (0, validateRequest_1.default)(auth_validation_1.AuthValidation.signUpZodSchema), auth_controller_1.AuthController.signUp);
router.post("/register", signupFileUpload, signupParseFiles, (0, validateRequest_1.default)(auth_validation_1.AuthValidation.signUpZodSchema), auth_controller_1.AuthController.signUp);
/* ---------------------------- LOGIN ---------------------------------------- */
router.post("/login", (0, validateRequest_1.default)(auth_validation_1.AuthValidation.createLoginZodSchema), auth_controller_1.AuthController.loginUser);
/* ---------------------------- VERIFY EMAIL --------------------------------- */
router.post("/verify-email", (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, oneTimeCode } = req.body;
        req.body = { email, oneTimeCode: Number(oneTimeCode) };
        next();
    }
    catch (error) {
        return res
            .status(500)
            .json({ message: "Failed to convert string to number" });
    }
}), (0, validateRequest_1.default)(auth_validation_1.AuthValidation.createVerifyEmailZodSchema), auth_controller_1.AuthController.verifyEmail);
/* ---------------------------- RESEND OTP ----------------------------------- */
router.post("/resend-otp", auth_controller_1.AuthController.resendVerificationEmail);
/* ---------------------------- PASSWORD MANAGEMENT -------------------------- */
router.post("/forget-password", (0, validateRequest_1.default)(auth_validation_1.AuthValidation.createForgetPasswordZodSchema), auth_controller_1.AuthController.forgetPassword);
router.post("/reset-password", (0, validateRequest_1.default)(auth_validation_1.AuthValidation.createResetPasswordZodSchema), auth_controller_1.AuthController.resetPassword);
router.post("/change-password", (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.HOME_OWNER, user_1.USER_ROLES.PROFESSIONAL), (0, validateRequest_1.default)(auth_validation_1.AuthValidation.createChangePasswordZodSchema), auth_controller_1.AuthController.changePassword);
/* ---------------------------- TOKEN REFRESH -------------------------------- */
router.post("/refresh-token", auth_controller_1.AuthController.newAccessToken);
/* ---------------------------- DELETE ACCOUNT ------------------------------- */
router.delete("/delete-account", (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.HOME_OWNER, user_1.USER_ROLES.PROFESSIONAL), auth_controller_1.AuthController.deleteUser);
/* ---------------------------- SOCIAL LOGIN --------------------------------- */
router.post("/google-login", auth_controller_1.AuthController.googleLogin);
exports.AuthRoutes = router;
