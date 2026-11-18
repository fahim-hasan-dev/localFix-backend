"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SiteSettings = void 0;
const mongoose_1 = require("mongoose");
const siteSettingsSchema = new mongoose_1.Schema({
    platformBrandName: {
        type: String,
        required: true,
        trim: true,
    },
    headerLogo: {
        type: String,
        trim: true,
    },
    footerLogo: {
        type: String,
        trim: true,
    },
    favicon: {
        type: String,
        trim: true,
    },
    supportEmail: {
        type: String,
        required: true,
        trim: true,
    },
    supportPhone: {
        type: String,
        required: true,
        trim: true,
    },
    address: {
        type: String,
        required: true,
        trim: true,
    },
    facebookUrl: {
        type: String,
        trim: true,
    },
    instagramUrl: {
        type: String,
        trim: true,
    },
    linkedinUrl: {
        type: String,
        trim: true,
    },
}, {
    timestamps: true,
    versionKey: false,
});
exports.SiteSettings = (0, mongoose_1.model)("SiteSettings", siteSettingsSchema);
