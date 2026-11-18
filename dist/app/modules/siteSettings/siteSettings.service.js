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
exports.SiteSettingsService = void 0;
const http_status_codes_1 = require("http-status-codes");
const ApiErrors_1 = __importDefault(require("../../../errors/ApiErrors"));
const unlinkFile_1 = __importDefault(require("../../../shared/unlinkFile"));
const siteSettings_model_1 = require("./siteSettings.model");
const FILE_FIELDS = ["headerLogo", "footerLogo", "favicon"];
const cleanupUploadedFiles = (payload) => {
    for (const field of FILE_FIELDS) {
        if (payload[field]) {
            (0, unlinkFile_1.default)(payload[field]);
        }
    }
};
const upsertSiteSettingsToDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const existingSiteSettings = yield siteSettings_model_1.SiteSettings.findOne();
    if (existingSiteSettings) {
        for (const field of FILE_FIELDS) {
            if (payload[field] &&
                existingSiteSettings[field] &&
                payload[field] !== existingSiteSettings[field]) {
                (0, unlinkFile_1.default)(existingSiteSettings[field]);
            }
        }
        const updatedSiteSettings = yield siteSettings_model_1.SiteSettings.findByIdAndUpdate(existingSiteSettings._id, payload, {
            new: true,
            runValidators: true,
        });
        if (!updatedSiteSettings) {
            cleanupUploadedFiles(payload);
            throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Failed to update site settings");
        }
        return updatedSiteSettings;
    }
    if (!payload.platformBrandName ||
        !payload.supportEmail ||
        !payload.supportPhone ||
        !payload.address) {
        cleanupUploadedFiles(payload);
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Platform brand name, support email, support phone, and address are required to create site settings");
    }
    const createdSiteSettings = yield siteSettings_model_1.SiteSettings.create(payload);
    if (!createdSiteSettings) {
        cleanupUploadedFiles(payload);
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Failed to create site settings");
    }
    return createdSiteSettings;
});
const getSiteSettingsFromDB = () => __awaiter(void 0, void 0, void 0, function* () {
    return yield siteSettings_model_1.SiteSettings.findOne();
});
exports.SiteSettingsService = {
    upsertSiteSettingsToDB,
    getSiteSettingsFromDB,
};
