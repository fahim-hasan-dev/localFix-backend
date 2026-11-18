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
exports.ContactUsServices = void 0;
const mongoose_1 = require("mongoose");
const config_1 = __importDefault(require("../../../config"));
const ApiErrors_1 = __importDefault(require("../../../errors/ApiErrors"));
const emailHelper_1 = require("../../../helpers/emailHelper");
const user_model_1 = require("../user/user.model");
const siteSettings_model_1 = require("../siteSettings/siteSettings.model");
const contactUs_model_1 = require("./contactUs.model");
const queryBuilder_1 = __importDefault(require("../../builder/queryBuilder"));
const emailTemplate_1 = require("../../../shared/emailTemplate");
const submitContactUs = (payload, userId) => __awaiter(void 0, void 0, void 0, function* () {
    if (userId) {
        const user = yield user_model_1.User.isExistUserById(userId);
        if (user) {
            payload.userId = new mongoose_1.Types.ObjectId(userId);
            if (!payload.name) {
                payload.name = user.name || "Unknown";
            }
            if (!payload.email) {
                payload.email = user.email || "Unknown";
            }
        }
    }
    const contactUsEntry = yield contactUs_model_1.ContactUs.create(payload);
    // Determine recipient email: config support_receiver_email, or SiteSettings supportEmail, or config email.user
    let receiverEmail = config_1.default.support_receiver_email;
    if (!receiverEmail) {
        try {
            const siteSettings = yield siteSettings_model_1.SiteSettings.findOne();
            receiverEmail = siteSettings === null || siteSettings === void 0 ? void 0 : siteSettings.supportEmail;
        }
        catch (_a) {
            // ignore
        }
    }
    if (!receiverEmail) {
        receiverEmail = config_1.default.email.user;
    }
    if (receiverEmail) {
        try {
            const emailPayload = emailTemplate_1.emailTemplate.contactUsNotification({
                to: receiverEmail,
                name: payload.name,
                email: payload.email,
                subject: payload.subject,
                message: payload.message,
            });
            yield emailHelper_1.emailHelper.sendEmail(emailPayload);
        }
        catch (error) {
            console.error("Failed to send contact us notification email:", error);
        }
    }
    return contactUsEntry;
});
const getAllContactUsFromDB = (query) => __awaiter(void 0, void 0, void 0, function* () {
    const baseQuery = contactUs_model_1.ContactUs.find().populate({
        path: "userId",
        select: "_id firstName lastName name email phone role profileImage",
    });
    const queryBuilder = new queryBuilder_1.default(baseQuery, query)
        .search(["name", "email", "subject", "message"])
        .sort()
        .fields()
        .filter()
        .paginate();
    const [contactMessages, meta] = yield Promise.all([
        queryBuilder.modelQuery.lean(),
        queryBuilder.countTotal(),
    ]);
    return {
        data: contactMessages || [],
        meta,
    };
});
const getContactUsByIdFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const contact = yield contactUs_model_1.ContactUs.findById(id).populate({
        path: "userId",
        select: "firstName lastName name role profileImage email _id phone",
    });
    if (!contact) {
        throw new ApiErrors_1.default(404, "No contact message is found by this ID");
    }
    return contact;
});
const updateContactUsStatusInDB = (id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const contact = yield contactUs_model_1.ContactUs.findByIdAndUpdate(id, payload, {
        new: true,
        runValidators: true,
    });
    if (!contact) {
        throw new ApiErrors_1.default(404, "No contact message is found by this ID");
    }
    return contact;
});
const deleteContactUsByIdFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const contact = yield contactUs_model_1.ContactUs.softDeleteById(id);
    if (!contact) {
        throw new ApiErrors_1.default(400, "Failed to delete this contact message by this ID");
    }
    return contact;
});
exports.ContactUsServices = {
    submitContactUs,
    getAllContactUsFromDB,
    getContactUsByIdFromDB,
    updateContactUsStatusInDB,
    deleteContactUsByIdFromDB,
};
