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
exports.BannerService = void 0;
const http_status_codes_1 = require("http-status-codes");
const banner_model_1 = require("./banner.model");
const unlinkFile_1 = __importDefault(require("../../../shared/unlinkFile"));
const ApiErrors_1 = __importDefault(require("../../../errors/ApiErrors"));
const upsertBannerToDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const existingBanner = yield banner_model_1.Banner.findOne();
    if (existingBanner) {
        if (payload.image &&
            existingBanner.image &&
            payload.image !== existingBanner.image) {
            (0, unlinkFile_1.default)(existingBanner.image);
        }
        const updatedBanner = yield banner_model_1.Banner.findByIdAndUpdate(existingBanner._id, payload, {
            new: true,
            runValidators: true,
        });
        if (!updatedBanner) {
            throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Failed to update banner");
        }
        return updatedBanner;
    }
    if (!payload.headline || !payload.description || !payload.image) {
        if (payload.image) {
            (0, unlinkFile_1.default)(payload.image);
        }
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Headline, description, and image are required to create a banner");
    }
    const createdBanner = yield banner_model_1.Banner.create(payload);
    if (!createdBanner) {
        if (payload.image) {
            (0, unlinkFile_1.default)(payload.image);
        }
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Failed to create banner");
    }
    return createdBanner;
});
const getBannerFromDB = () => __awaiter(void 0, void 0, void 0, function* () {
    return yield banner_model_1.Banner.findOne();
});
exports.BannerService = {
    upsertBannerToDB,
    getBannerFromDB,
};
