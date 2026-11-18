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
exports.validateCategoryExists = exports.mergeBusinessHours = exports.normalizeLiabilityInsurance = exports.normalizeTradeLicense = exports.parseServiceRadius = exports.parseBooleanFlag = void 0;
const http_status_codes_1 = require("http-status-codes");
const ApiErrors_1 = __importDefault(require("../../../errors/ApiErrors"));
const category_model_1 = require("../category/category.model");
/**
 * Parse boolean values sent via JSON or multipart/form-data strings.
 */
const parseBooleanFlag = (value) => {
    if (typeof value === "boolean")
        return value;
    if (typeof value === "string") {
        return value.trim().toLowerCase() === "true";
    }
    return false;
};
exports.parseBooleanFlag = parseBooleanFlag;
/**
 * Parse service radius whether sent as number (25) or string ("25" / "Within 25 miles").
 */
const parseServiceRadius = (value) => {
    if (value === undefined || value === null || value === "")
        return undefined;
    if (typeof value === "number" && !isNaN(value))
        return value;
    if (typeof value === "string") {
        const match = value.match(/\d+(\.\d+)?/);
        if (match) {
            const parsed = Number(match[0]);
            return isNaN(parsed) ? undefined : parsed;
        }
    }
    return undefined;
};
exports.parseServiceRadius = parseServiceRadius;
/**
 * Normalize trade license details from either nested `tradeLicense` object or flat fields.
 */
const normalizeTradeLicense = (payload) => {
    const nested = payload.tradeLicense && typeof payload.tradeLicense === "object"
        ? payload.tradeLicense
        : {};
    const licenseNumber = (nested.licenseNumber ||
        payload.licenseNumber ||
        "").trim();
    const state = (nested.state || payload.licenseState || payload.state || "")
        .trim()
        .toUpperCase();
    const certificateUrl = nested.certificateUrl ||
        payload.tradeLicenseCertificate ||
        (typeof payload.tradeLicense === "string" ? payload.tradeLicense : "") ||
        "";
    if (!licenseNumber && !state && !certificateUrl) {
        return undefined;
    }
    return Object.assign(Object.assign(Object.assign(Object.assign({}, (licenseNumber && { licenseNumber })), (state && { state })), (certificateUrl && { certificateUrl })), { isVerified: false });
};
exports.normalizeTradeLicense = normalizeTradeLicense;
/**
 * Normalize liability insurance details from either nested `liabilityInsurance` or flat fields.
 */
const normalizeLiabilityInsurance = (payload) => {
    const nested = payload.liabilityInsurance && typeof payload.liabilityInsurance === "object"
        ? payload.liabilityInsurance
        : {};
    const carrier = (nested.carrier ||
        payload.insuranceCarrier ||
        payload.carrier ||
        "").trim();
    const coverage = (nested.coverage ||
        payload.insuranceCoverage ||
        payload.coverage ||
        "")
        .toString()
        .trim();
    const expires = (nested.expires ||
        nested.expiresAt ||
        payload.insuranceExpires ||
        payload.expires ||
        payload.expiresAt ||
        "")
        .toString()
        .trim();
    const certificateUrl = nested.certificateUrl ||
        payload.coiCertificate ||
        payload.insuranceCertificate ||
        "";
    if (!carrier && !coverage && !expires && !certificateUrl) {
        return undefined;
    }
    return Object.assign(Object.assign(Object.assign(Object.assign({}, (carrier && { carrier })), (coverage && { coverage })), (expires && { expires })), (certificateUrl && { certificateUrl }));
};
exports.normalizeLiabilityInsurance = normalizeLiabilityInsurance;
const DAY_KEYS = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
];
const mergeDayHours = (existing, incoming) => {
    var _a, _b, _c, _d, _e;
    return ({
        isOpen: (incoming === null || incoming === void 0 ? void 0 : incoming.isOpen) !== undefined
            ? (0, exports.parseBooleanFlag)(incoming.isOpen)
            : ((_a = existing === null || existing === void 0 ? void 0 : existing.isOpen) !== null && _a !== void 0 ? _a : true),
        openTime: (_c = (_b = incoming === null || incoming === void 0 ? void 0 : incoming.openTime) !== null && _b !== void 0 ? _b : existing === null || existing === void 0 ? void 0 : existing.openTime) !== null && _c !== void 0 ? _c : "8:00 AM",
        closeTime: (_e = (_d = incoming === null || incoming === void 0 ? void 0 : incoming.closeTime) !== null && _d !== void 0 ? _d : existing === null || existing === void 0 ? void 0 : existing.closeTime) !== null && _e !== void 0 ? _e : "6:00 PM",
    });
};
/**
 * Merge incoming businessHours updates with existing user businessHours.
 */
const mergeBusinessHours = (existing, incoming, emergencyDispatchTopLevel) => {
    var _a, _b, _c, _d, _e;
    const days = {};
    for (const day of DAY_KEYS) {
        days[day] = mergeDayHours((_a = existing === null || existing === void 0 ? void 0 : existing.days) === null || _a === void 0 ? void 0 : _a[day], (_b = incoming === null || incoming === void 0 ? void 0 : incoming.days) === null || _b === void 0 ? void 0 : _b[day]);
    }
    const emergencyDispatchAvailable = emergencyDispatchTopLevel !== undefined
        ? (0, exports.parseBooleanFlag)(emergencyDispatchTopLevel)
        : (incoming === null || incoming === void 0 ? void 0 : incoming.emergencyDispatchAvailable) !== undefined
            ? (0, exports.parseBooleanFlag)(incoming.emergencyDispatchAvailable)
            : ((_c = existing === null || existing === void 0 ? void 0 : existing.emergencyDispatchAvailable) !== null && _c !== void 0 ? _c : false);
    return {
        mode: (_e = (_d = incoming === null || incoming === void 0 ? void 0 : incoming.mode) !== null && _d !== void 0 ? _d : existing === null || existing === void 0 ? void 0 : existing.mode) !== null && _e !== void 0 ? _e : "all_days",
        allDays: mergeDayHours(existing === null || existing === void 0 ? void 0 : existing.allDays, incoming === null || incoming === void 0 ? void 0 : incoming.allDays),
        days,
        emergencyDispatchAvailable,
    };
};
exports.mergeBusinessHours = mergeBusinessHours;
/**
 * Ensure the selected trade category ID exists and is not deleted.
 */
const validateCategoryExists = (categoryId) => __awaiter(void 0, void 0, void 0, function* () {
    const category = yield category_model_1.Category.findOne({
        _id: categoryId,
        isDeleted: { $ne: true },
    }).lean();
    if (!category) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Selected primary trade category does not exist");
    }
    return category;
});
exports.validateCategoryExists = validateCategoryExists;
