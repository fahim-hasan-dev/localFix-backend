"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Faq = void 0;
const mongoose_1 = require("mongoose");
const softDeletePlugin_1 = require("../../../DB/plugins/softDeletePlugin");
const user_1 = require("../../../enums/user");
const faq_constant_1 = require("./faq.constant");
const faqSchema = new mongoose_1.Schema({
    question: {
        type: String,
        required: true,
        trim: true,
    },
    answer: {
        type: String,
        required: true,
        trim: true,
    },
    role: {
        type: String,
        enum: faq_constant_1.FAQ_ROLES,
        default: user_1.USER_ROLES.HOME_OWNER,
        required: true,
        trim: true,
        lowercase: true,
    },
    order: {
        type: Number,
        default: 0,
    },
}, {
    timestamps: true,
    versionKey: false,
});
faqSchema.index({ role: 1, order: 1 });
faqSchema.plugin(softDeletePlugin_1.softDeletePlugin);
exports.Faq = (0, mongoose_1.model)("Faq", faqSchema);
