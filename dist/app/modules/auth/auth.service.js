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
exports.AuthService = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const http_status_codes_1 = require("http-status-codes");
const config_1 = __importDefault(require("../../../config"));
const ApiErrors_1 = __importDefault(require("../../../errors/ApiErrors"));
const jwtHelper_1 = require("../../../helpers/jwtHelper");
const user_model_1 = require("../user/user.model");
const cryptoToken_1 = __importDefault(require("../../../util/cryptoToken"));
const resetToken_model_1 = require("../resetToken/resetToken.model");
const emailHelper_1 = require("../../../helpers/emailHelper");
const generateOTP_1 = __importDefault(require("../../../util/generateOTP"));
const emailTemplate_1 = require("../../../shared/emailTemplate");
const user_1 = require("../../../enums/user");
const firebase_1 = require("../../../config/firebase");
const fcmService_1 = require("../fcmToken/fcmService");
const notificationsHelper_1 = require("../../../helpers/notificationsHelper");
const notification_constant_1 = require("../notification/notification.constant");
const user_helper_1 = require("../user/user.helper");
const checkr_service_1 = require("../checkr/checkr.service");
const mongoose_1 = require("mongoose");
// ========================== Sign Up (Homeowner & Professional) ===========================
const signUpUserToDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    const { email, password, name, fcmToken, deviceId, deviceType } = payload;
    if (!email) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Email is required!");
    }
    if (!password) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Password is required!");
    }
    if (!name) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Name is required!");
    }
    const validRoles = [user_1.USER_ROLES.HOME_OWNER, user_1.USER_ROLES.PROFESSIONAL];
    const role = payload.role && validRoles.includes(payload.role)
        ? payload.role
        : user_1.USER_ROLES.HOME_OWNER;
    const normalizedEmail = email.trim().toLowerCase();
    // Check if user already exists
    const isExistUser = yield user_model_1.User.findOne({ email: normalizedEmail });
    if (isExistUser) {
        if (isExistUser.verified) {
            throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.CONFLICT, "This email is already registered!");
        }
        // Remove stale unverified user to allow clean re-registration
        yield user_model_1.User.deleteOne({ _id: isExistUser._id });
    }
    const baseUserPayload = {
        name: name.trim(),
        email: normalizedEmail,
        password,
        role,
        phone: (_a = payload.phone) === null || _a === void 0 ? void 0 : _a.trim(),
        countryCode: (_b = payload.countryCode) === null || _b === void 0 ? void 0 : _b.trim(),
        zipCode: (_c = payload.zipCode) === null || _c === void 0 ? void 0 : _c.trim(),
        profileImage: payload.profileImage || "",
        verified: false,
        status: user_1.STATUS.ACTIVE,
    };
    if (role === user_1.USER_ROLES.HOME_OWNER) {
        const agreedToTerms = (0, user_helper_1.parseBooleanFlag)(payload.agreedToTerms);
        if (!agreedToTerms) {
            throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "You must agree to the Terms & Conditions and Privacy Policy.");
        }
        baseUserPayload.agreedToTerms = true;
        baseUserPayload.termsAcceptedAt = new Date();
        baseUserPayload.approvalStatus = user_1.APPROVAL_STATUS.APPROVED;
    }
    else {
        // Professional signup validations & field assembly
        if (password.length < 8) {
            throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Password must be at least 8 characters for professionals.");
        }
        const companyName = (payload.companyName ||
            payload.businessName ||
            "").trim();
        if (!companyName) {
            throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Business name is required for professionals.");
        }
        if (!payload.category) {
            throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Primary trade category ID is required for professionals.");
        }
        yield (0, user_helper_1.validateCategoryExists)(payload.category);
        const serviceRadiusInMiles = (0, user_helper_1.parseServiceRadius)(payload.serviceRadiusInMiles);
        if (!serviceRadiusInMiles || serviceRadiusInMiles <= 0) {
            throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Valid service radius in miles is required for professionals.");
        }
        const tradeLicense = (0, user_helper_1.normalizeTradeLicense)(payload);
        if (!(tradeLicense === null || tradeLicense === void 0 ? void 0 : tradeLicense.licenseNumber) || !(tradeLicense === null || tradeLicense === void 0 ? void 0 : tradeLicense.state)) {
            throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Trade license number and state are required for professionals.");
        }
        const backgroundCheckConsent = (0, user_helper_1.parseBooleanFlag)(payload.backgroundCheckConsent);
        if (!backgroundCheckConsent) {
            throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "You must agree to complete the background check on Checkr.");
        }
        const liabilityInsurance = (0, user_helper_1.normalizeLiabilityInsurance)(payload);
        baseUserPayload.companyName = companyName;
        baseUserPayload.category = new mongoose_1.Types.ObjectId(payload.category);
        baseUserPayload.serviceRadiusInMiles = serviceRadiusInMiles;
        baseUserPayload.state = tradeLicense.state;
        baseUserPayload.tradeLicense = tradeLicense;
        if (liabilityInsurance) {
            baseUserPayload.liabilityInsurance = liabilityInsurance;
        }
        baseUserPayload.agreedToTerms = (0, user_helper_1.parseBooleanFlag)(payload.agreedToTerms);
        if (baseUserPayload.agreedToTerms) {
            baseUserPayload.termsAcceptedAt = new Date();
        }
        baseUserPayload.approvalStatus = user_1.APPROVAL_STATUS.PENDING;
        const hasPreCreatedCheckr = Boolean(payload.checkrCandidateId && payload.checkrInvitationId);
        baseUserPayload.backgroundCheck = Object.assign(Object.assign(Object.assign(Object.assign({ consentAccepted: true, consentAcceptedAt: new Date(), status: hasPreCreatedCheckr
                ? user_1.CHECKR_VERIFICATION_STATUS.PENDING
                : user_1.CHECKR_VERIFICATION_STATUS.NOT_STARTED, passed: false }, (payload.checkrCandidateId && {
            checkrCandidateId: payload.checkrCandidateId,
        })), (payload.checkrInvitationId && {
            checkrInvitationId: payload.checkrInvitationId,
        })), (payload.checkrInvitationUrl && {
            checkrInvitationUrl: payload.checkrInvitationUrl,
        })), { invitationStatus: hasPreCreatedCheckr
                ? user_1.CHECKR_INVITATION_STATUS.PENDING
                : user_1.CHECKR_INVITATION_STATUS.NOT_SENT });
    }
    // Generate 6-digit OTP
    const otp = (0, generateOTP_1.default)();
    baseUserPayload.authentication = {
        oneTimeCode: Number(otp),
        expireAt: new Date(Date.now() + 5 * 60000), // 5 minutes validity
        isResetPassword: false,
    };
    const newUser = yield user_model_1.User.create(baseUserPayload);
    if (!newUser) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Failed to create user account!");
    }
    // Initiate Checkr background check for professionals if not already started on Step 4
    let checkrData;
    let checkrError;
    if (role === user_1.USER_ROLES.PROFESSIONAL) {
        if ((_d = newUser.backgroundCheck) === null || _d === void 0 ? void 0 : _d.checkrInvitationId) {
            checkrData = {
                candidateId: newUser.backgroundCheck.checkrCandidateId,
                invitationId: newUser.backgroundCheck.checkrInvitationId,
                invitationUrl: newUser.backgroundCheck.checkrInvitationUrl,
                status: newUser.backgroundCheck.status,
                invitationStatus: newUser.backgroundCheck.invitationStatus,
            };
        }
        else {
            try {
                checkrData = yield checkr_service_1.CheckrService.initiateBackgroundCheckForUser(newUser._id.toString());
            }
            catch (err) {
                checkrError =
                    (err === null || err === void 0 ? void 0 : err.message) || "Failed to automatically initiate Checkr screening";
            }
        }
    }
    // Save device token if provided
    if (fcmToken && deviceId && deviceType) {
        yield fcmService_1.FcmTokenService.saveDeviceToken(newUser._id, {
            fcmToken,
            deviceId,
            deviceType,
        });
    }
    // Send verification email
    const emailValues = {
        name: newUser.name,
        otp: Number(otp),
        email: newUser.email,
    };
    const accountEmailTemplate = emailTemplate_1.emailTemplate.createAccount(emailValues);
    emailHelper_1.emailHelper.sendEmail(accountEmailTemplate);
    // Generate token
    const token = jwtHelper_1.jwtHelper.createToken({
        id: newUser._id,
        email: newUser.email,
        role: newUser.role,
    }, config_1.default.jwt.jwt_secret, config_1.default.jwt.jwt_expire_in);
    // Notify admin
    const admin = yield user_model_1.User.findOne({ role: user_1.USER_ROLES.SUPER_ADMIN }).select("_id");
    if (admin) {
        yield (0, notificationsHelper_1.sendNotifications)({
            title: "New User Signup",
            text: `${newUser.name} has registered as a ${newUser.role}.`,
            receiver: admin._id.toString(),
            type: notification_constant_1.NOTIFICATION_TYPE.ADMIN,
            referenceId: newUser._id.toString(),
            referenceModel: "User",
        });
    }
    const populatedUser = yield user_model_1.User.findById(newUser._id)
        .populate("category", "name icon coverImage")
        .select("-password -authentication");
    return Object.assign(Object.assign({ message: role === user_1.USER_ROLES.PROFESSIONAL
            ? "Professional application submitted successfully. Please verify your email with the OTP sent to your inbox and complete your Checkr background check."
            : "Your account has been successfully created. Please verify your email with the OTP sent to your inbox.", token, user: populatedUser || newUser }, (checkrData && { checkr: checkrData })), (checkrError && { checkrError }));
});
// ========================== Login ===========================
const loginUserFromDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, password, fcmToken, deviceId, deviceType } = payload;
    const cleanInput = email ? email.trim() : "";
    const normalizedEmail = cleanInput.toLowerCase();
    const isExistUser = yield user_model_1.User.findOne({
        $or: [{ email: normalizedEmail }, { phone: cleanInput }],
    })
        .select("+password")
        .populate("category", "name icon coverImage");
    if (!isExistUser) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "User doesn't exist!");
    }
    // check verification status
    if (!isExistUser.verified) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Please verify your account before logging in.");
    }
    // check active status
    if (isExistUser.status === user_1.STATUS.INACTIVE) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "Your account has been deactivated. Please contact support.");
    }
    // check password
    if (password &&
        !(yield user_model_1.User.isMatchPassword(password, isExistUser.password))) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Password is incorrect!");
    }
    // Save device token if provided
    if (fcmToken && deviceId && deviceType) {
        yield fcmService_1.FcmTokenService.saveDeviceToken(isExistUser._id, {
            fcmToken,
            deviceId,
            deviceType,
        });
    }
    // create access token
    const createToken = jwtHelper_1.jwtHelper.createToken({
        id: isExistUser._id,
        role: isExistUser.role,
        email: isExistUser.email,
    }, config_1.default.jwt.jwt_secret, config_1.default.jwt.jwt_expire_in);
    // create refresh token
    const refreshToken = jwtHelper_1.jwtHelper.createToken({
        id: isExistUser._id,
        role: isExistUser.role,
        email: isExistUser.email,
    }, config_1.default.jwt.jwtRefreshSecret, config_1.default.jwt.jwtRefreshExpiresIn || "30d");
    return {
        token: createToken,
        refreshToken,
        data: isExistUser,
    };
});
// ========================== Forget Password ===========================
const forgetPasswordToDB = (email) => __awaiter(void 0, void 0, void 0, function* () {
    const normalizedEmail = email === null || email === void 0 ? void 0 : email.trim().toLowerCase();
    const isExistUser = yield user_model_1.User.findOne({ email: normalizedEmail });
    if (!isExistUser) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "User doesn't exist!");
    }
    const otp = (0, generateOTP_1.default)();
    const value = {
        otp: Number(otp),
        email: isExistUser.email,
    };
    const forgetPassword = emailTemplate_1.emailTemplate.resetPassword(value);
    emailHelper_1.emailHelper.sendEmail(forgetPassword);
    const authentication = {
        oneTimeCode: Number(otp),
        expireAt: new Date(Date.now() + 5 * 60000),
        isResetPassword: false,
    };
    yield user_model_1.User.findOneAndUpdate({ _id: isExistUser._id }, { $set: { authentication } });
    return { message: "A password reset OTP has been sent to your email." };
});
// ========================== Verify Email / OTP ===========================
const verifyEmailToDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { email, oneTimeCode } = payload;
    const normalizedEmail = email === null || email === void 0 ? void 0 : email.trim().toLowerCase();
    const isExistUser = yield user_model_1.User.findOne({ email: normalizedEmail }).select("+authentication");
    if (!isExistUser) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "User doesn't exist!");
    }
    if (!oneTimeCode) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Please provide the OTP code sent to your email.");
    }
    if (((_a = isExistUser.authentication) === null || _a === void 0 ? void 0 : _a.oneTimeCode) !== oneTimeCode) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Invalid OTP code!");
    }
    const date = new Date();
    if (((_b = isExistUser.authentication) === null || _b === void 0 ? void 0 : _b.expireAt) &&
        date > isExistUser.authentication.expireAt) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "OTP code has expired. Please request a new one.");
    }
    let message;
    let data;
    if (!isExistUser.verified) {
        // Signup verification flow
        const updatedUser = yield user_model_1.User.findOneAndUpdate({ _id: isExistUser._id }, {
            verified: true,
            authentication: {
                oneTimeCode: null,
                expireAt: null,
                isResetPassword: false,
            },
        }, { new: true }).populate("category", "name icon coverImage");
        const token = jwtHelper_1.jwtHelper.createToken({
            id: isExistUser._id,
            role: isExistUser.role,
            email: isExistUser.email,
        }, config_1.default.jwt.jwt_secret, config_1.default.jwt.jwt_expire_in);
        const refreshToken = jwtHelper_1.jwtHelper.createToken({
            id: isExistUser._id,
            role: isExistUser.role,
            email: isExistUser.email,
        }, config_1.default.jwt.jwtRefreshSecret, config_1.default.jwt.jwtRefreshExpiresIn || "30d");
        message = "Email verified successfully.";
        data = {
            token,
            refreshToken,
            user: updatedUser,
        };
    }
    else {
        // Forgot password flow
        yield user_model_1.User.findOneAndUpdate({ _id: isExistUser._id }, {
            authentication: {
                isResetPassword: true,
                oneTimeCode: null,
                expireAt: null,
            },
        });
        const createToken = (0, cryptoToken_1.default)();
        yield resetToken_model_1.ResetToken.create({
            user: isExistUser._id,
            token: createToken,
            expireAt: new Date(Date.now() + 5 * 60000),
        });
        message =
            "Verification successful. Please securely use this token to reset your password.";
        data = createToken;
    }
    return { data, message };
});
// ========================== Reset Password ===========================
const resetPasswordToDB = (token, payload) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { newPassword, confirmPassword } = payload;
    if (!token) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, "Reset token is required!");
    }
    const isExistToken = yield resetToken_model_1.ResetToken.isExistToken(token);
    if (!isExistToken) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, "You are not authorized!");
    }
    const isExistUser = yield user_model_1.User.findById(isExistToken.user).select("+authentication");
    if (!((_a = isExistUser === null || isExistUser === void 0 ? void 0 : isExistUser.authentication) === null || _a === void 0 ? void 0 : _a.isResetPassword)) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, "You don't have permission to change the password. Please initiate 'Forgot Password' again.");
    }
    const isValid = yield resetToken_model_1.ResetToken.isExpireToken(token);
    if (!isValid) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Reset token expired. Please initiate 'Forgot Password' again.");
    }
    if (newPassword !== confirmPassword) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "New password and confirm password do not match!");
    }
    const hashPassword = yield bcrypt_1.default.hash(newPassword, Number(config_1.default.bcrypt_salt_rounds));
    yield user_model_1.User.findOneAndUpdate({ _id: isExistToken.user }, {
        password: hashPassword,
        authentication: {
            isResetPassword: false,
            oneTimeCode: null,
            expireAt: null,
        },
    }, { new: true });
    yield resetToken_model_1.ResetToken.deleteOne({ token });
    return { message: "Password reset successfully." };
});
// ========================== Change Password ===========================
const changePasswordToDB = (user, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const { currentPassword, newPassword, confirmPassword } = payload;
    const isExistUser = yield user_model_1.User.findById(user.id).select("+password");
    if (!isExistUser) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "User doesn't exist!");
    }
    if (currentPassword &&
        !(yield user_model_1.User.isMatchPassword(currentPassword, isExistUser.password))) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Current password is incorrect!");
    }
    if (currentPassword === newPassword) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "New password must be different from current password!");
    }
    if (newPassword !== confirmPassword) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "New password and confirm password do not match!");
    }
    const hashPassword = yield bcrypt_1.default.hash(newPassword, Number(config_1.default.bcrypt_salt_rounds));
    yield user_model_1.User.findOneAndUpdate({ _id: user.id }, { password: hashPassword }, { new: true });
});
// ========================== Refresh Access Token ===========================
const newAccessTokenToUser = (token) => __awaiter(void 0, void 0, void 0, function* () {
    if (!token) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Refresh token is required!");
    }
    const verifyUser = jwtHelper_1.jwtHelper.verifyToken(token, config_1.default.jwt.jwtRefreshSecret);
    const isExistUser = yield user_model_1.User.findById(verifyUser === null || verifyUser === void 0 ? void 0 : verifyUser.id);
    if (!isExistUser) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, "Unauthorized access!");
    }
    const accessToken = jwtHelper_1.jwtHelper.createToken({
        id: isExistUser._id,
        role: isExistUser.role,
        email: isExistUser.email,
    }, config_1.default.jwt.jwt_secret, config_1.default.jwt.jwt_expire_in);
    return { accessToken };
});
// ========================== Resend Verification OTP ===========================
const resendVerificationEmailToDB = (email) => __awaiter(void 0, void 0, void 0, function* () {
    if (!email) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Email is required!");
    }
    const normalizedEmail = email === null || email === void 0 ? void 0 : email.trim().toLowerCase();
    const existingUser = yield user_model_1.User.findOne({ email: normalizedEmail });
    if (!existingUser) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "User with this email does not exist!");
    }
    const otp = (0, generateOTP_1.default)();
    if (existingUser.verified) {
        const emailValues = {
            otp: Number(otp),
            email: existingUser.email,
        };
        const resetPasswordTemplate = emailTemplate_1.emailTemplate.resetPassword(emailValues);
        emailHelper_1.emailHelper.sendEmail(resetPasswordTemplate);
    }
    else {
        const emailValues = {
            name: existingUser.name,
            otp: Number(otp),
            email: existingUser.email,
        };
        const accountEmailTemplate = emailTemplate_1.emailTemplate.createAccount(emailValues);
        emailHelper_1.emailHelper.sendEmail(accountEmailTemplate);
    }
    const authentication = {
        oneTimeCode: Number(otp),
        expireAt: new Date(Date.now() + 5 * 60000),
        isResetPassword: false,
    };
    yield user_model_1.User.findOneAndUpdate({ _id: existingUser._id }, { $set: { authentication } }, { new: true });
    return {
        message: "A new OTP verification code has been sent to your email.",
    };
});
// ========================== Delete User Account ===========================
const deleteUserFromDB = (user, password) => __awaiter(void 0, void 0, void 0, function* () {
    const isExistUser = yield user_model_1.User.findById(user.id).select("+password");
    if (!isExistUser) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "User doesn't exist!");
    }
    if (isExistUser.password &&
        password &&
        !(yield user_model_1.User.isMatchPassword(password, isExistUser.password))) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Password is incorrect!");
    }
    yield user_model_1.User.softDeleteById(user.id);
    return;
});
// ========================== Google Social Login ===========================
const googleLoginService = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const { token, fcmToken, deviceId, deviceType, role, zipCode, phone } = payload;
    if (!token) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Firebase ID token is required!");
    }
    let decoded;
    try {
        decoded = yield firebase_1.firebaseAdmin.auth().verifyIdToken(token);
    }
    catch (error) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, "Invalid or expired Firebase token!");
    }
    const { uid: firebaseUid, email, name, picture } = decoded;
    if (!email) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Email not found in Google account!");
    }
    let user = yield user_model_1.User.findOne({
        $or: [{ firebaseUid }, { email: email.toLowerCase() }],
    });
    const validRoles = [user_1.USER_ROLES.HOME_OWNER, user_1.USER_ROLES.PROFESSIONAL];
    const assignedRole = role && validRoles.includes(role) ? role : user_1.USER_ROLES.HOME_OWNER;
    if (user) {
        if (user.status === user_1.STATUS.INACTIVE) {
            throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "Your account has been blocked. Please contact support.");
        }
        if (!user.firebaseUid) {
            user.firebaseUid = firebaseUid;
        }
        user.verified = true;
        if (picture && !user.profileImage) {
            user.profileImage = picture;
        }
        yield user.save();
    }
    else {
        const fallbackName = email.split("@")[0];
        user = yield user_model_1.User.create(Object.assign(Object.assign(Object.assign({ firebaseUid, email: email.toLowerCase(), name: name || fallbackName, profileImage: picture || "" }, (zipCode && { zipCode: zipCode.trim() })), (phone && { phone: phone.trim() })), { agreedToTerms: true, termsAcceptedAt: new Date(), verified: true, status: user_1.STATUS.ACTIVE, approvalStatus: assignedRole === user_1.USER_ROLES.HOME_OWNER
                ? user_1.APPROVAL_STATUS.APPROVED
                : user_1.APPROVAL_STATUS.PENDING, role: assignedRole }));
    }
    if (fcmToken && deviceId && deviceType) {
        yield fcmService_1.FcmTokenService.saveDeviceToken(user._id, {
            fcmToken,
            deviceId,
            deviceType,
        });
    }
    const createToken = jwtHelper_1.jwtHelper.createToken({
        id: user._id,
        role: user.role,
        email: user.email,
    }, config_1.default.jwt.jwt_secret, config_1.default.jwt.jwt_expire_in);
    const refreshToken = jwtHelper_1.jwtHelper.createToken({
        id: user._id,
        role: user.role,
        email: user.email,
    }, config_1.default.jwt.jwtRefreshSecret, config_1.default.jwt.jwtRefreshExpiresIn || "30d");
    return {
        token: createToken,
        refreshToken,
        user,
    };
});
exports.AuthService = {
    signUpUserToDB,
    loginUserFromDB,
    forgetPasswordToDB,
    resetPasswordToDB,
    verifyEmailToDB,
    changePasswordToDB,
    newAccessTokenToUser,
    resendVerificationEmailToDB,
    deleteUserFromDB,
    googleLoginService,
};
