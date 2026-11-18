"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContactUs = void 0;
const mongoose_1 = require("mongoose");
const softDeletePlugin_1 = require("../../../DB/plugins/softDeletePlugin");
const contactUs_constant_1 = require("./contactUs.constant");
const contactUsSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: false,
    },
    name: {
        type: String,
        required: [true, "Full name is required"],
        trim: true,
    },
    email: {
        type: String,
        required: [true, "Email address is required"],
        trim: true,
        lowercase: true,
    },
    subject: {
        type: String,
        required: [true, "Subject is required"],
        trim: true,
    },
    message: {
        type: String,
        required: [true, "Message is required"],
        trim: true,
    },
    status: {
        type: String,
        enum: Object.values(contactUs_constant_1.CONTACT_US_STATUS),
        default: contactUs_constant_1.CONTACT_US_STATUS.PENDING,
    },
    priority: {
        type: String,
        enum: Object.values(contactUs_constant_1.CONTACT_US_PRIORITY),
        default: contactUs_constant_1.CONTACT_US_PRIORITY.LOW,
    },
}, {
    timestamps: true,
    versionKey: false,
});
contactUsSchema.plugin(softDeletePlugin_1.softDeletePlugin);
exports.ContactUs = (0, mongoose_1.model)("ContactUs", contactUsSchema);
