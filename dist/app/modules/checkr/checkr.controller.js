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
exports.CheckrControllers = void 0;
const crypto_1 = __importDefault(require("crypto"));
const http_status_codes_1 = require("http-status-codes");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const config_1 = __importDefault(require("../../../config"));
const ApiErrors_1 = __importDefault(require("../../../errors/ApiErrors"));
const checkr_service_1 = require("./checkr.service");
const initiateBackgroundCheck = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const user = req.user;
    const forceNew = ((_a = req.body) === null || _a === void 0 ? void 0 : _a.forceNew) === true || ((_b = req.body) === null || _b === void 0 ? void 0 : _b.forceNew) === "true";
    const result = yield checkr_service_1.CheckrService.initiateBackgroundCheckForUser(user.id, {
        forceNew,
    });
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: "Checkr background check screening link generated successfully",
        data: result,
    });
}));
const startPreSignupScreening = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield checkr_service_1.CheckrService.startPreSignupScreening(req.body);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: "Checkr screening portal link created successfully",
        data: result,
    });
}));
const getMyBackgroundCheckStatus = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const sync = req.query.sync === "true";
    const result = yield checkr_service_1.CheckrService.getBackgroundCheckStatusFromDB(user.id, sync);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: "Background check status retrieved successfully",
        data: result,
    });
}));
const getUserBackgroundCheckStatus = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId } = req.params;
    const sync = req.query.sync === "true";
    const result = yield checkr_service_1.CheckrService.getBackgroundCheckStatusFromDB(userId, sync);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: "Professional background check status retrieved successfully",
        data: result,
    });
}));
const handleWebhook = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let isSignatureVerified = false;
    const signatureHeader = req.headers["x-checkr-signature"];
    if (!signatureHeader) {
        if (process.env.NODE_ENV === "development") {
            console.warn("Warning: Missing x-checkr-signature header, bypassing signature check in development mode.");
            isSignatureVerified = true;
        }
        else {
            throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, "Missing x-checkr-signature header");
        }
    }
    const signingKey = config_1.default.checkr.signingKey || config_1.default.checkr.apiKey;
    if (!signingKey && !isSignatureVerified) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, "Checkr signing key or API key is not configured");
    }
    if (signatureHeader && signingKey && !isSignatureVerified) {
        const signature = signatureHeader.replace("sha256=", "");
        const rawBody = req.rawBody;
        if (!rawBody) {
            throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Raw body is missing for signature verification");
        }
        const computedHex = crypto_1.default
            .createHmac("sha256", signingKey)
            .update(rawBody)
            .digest("hex");
        const sigBuffer = Buffer.from(signature.toLowerCase(), "hex");
        const compBuffer = Buffer.from(computedHex.toLowerCase(), "hex");
        if (sigBuffer.length === compBuffer.length &&
            crypto_1.default.timingSafeEqual(sigBuffer, compBuffer)) {
            isSignatureVerified = true;
        }
        else if (process.env.NODE_ENV === "development") {
            console.warn("Warning: Invalid Checkr webhook signature, bypassing in development mode.");
            isSignatureVerified = true;
        }
        else {
            throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, "Invalid webhook signature");
        }
    }
    const result = yield checkr_service_1.CheckrService.processWebhookEvent(req.body);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: "Webhook event processed successfully",
        data: result,
    });
}));
exports.CheckrControllers = {
    initiateBackgroundCheck,
    startPreSignupScreening,
    getMyBackgroundCheckStatus,
    getUserBackgroundCheckStatus,
    handleWebhook,
};
