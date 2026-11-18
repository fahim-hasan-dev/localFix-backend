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
exports.ContactUsControllers = void 0;
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const contactUs_service_1 = require("./contactUs.service");
const submitContactUs = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const contactData = req.body;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    const result = yield contactUs_service_1.ContactUsServices.submitContactUs(contactData, userId);
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: "Your message has been sent successfully. A representative will reply to your email promptly.",
        data: result,
    });
}));
const getAllContactUs = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield contactUs_service_1.ContactUsServices.getAllContactUsFromDB(req.query);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: 200,
        message: "Contact messages retrieved successfully",
        data: result,
    });
}));
const getContactUsById = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const result = yield contactUs_service_1.ContactUsServices.getContactUsByIdFromDB(id);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: 200,
        message: "Contact message retrieved successfully by this ID",
        data: result,
    });
}));
const updateContactUsStatus = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const result = yield contactUs_service_1.ContactUsServices.updateContactUsStatusInDB(id, req.body);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: 200,
        message: "Contact message updated successfully",
        data: result,
    });
}));
const deleteContactUsById = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const result = yield contactUs_service_1.ContactUsServices.deleteContactUsByIdFromDB(id);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: 200,
        message: "Contact message deleted successfully",
        data: result,
    });
}));
exports.ContactUsControllers = {
    submitContactUs,
    getAllContactUs,
    getContactUsById,
    updateContactUsStatus,
    deleteContactUsById,
};
