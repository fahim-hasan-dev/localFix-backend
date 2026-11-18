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
exports.PackageService = void 0;
const http_status_codes_1 = require("http-status-codes");
const ApiErrors_1 = __importDefault(require("../../../errors/ApiErrors"));
const package_model_1 = require("./package.model");
const createPackageIntoDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const isExist = yield package_model_1.Package.findOne({
        name: { $regex: new RegExp(`^${payload.name}$`, "i") },
        isDeleted: { $ne: true },
    });
    if (isExist) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "A package with this name already exists");
    }
    // Sync trial fields
    if (payload.trialDays && payload.trialDays > 0) {
        payload.hasTrial = true;
    }
    else if (!payload.hasTrial) {
        payload.trialDays = 0;
    }
    // Ensure backward compatibility fields for price
    if (payload.price !== undefined) {
        if (payload.monthlyPrice === undefined) {
            payload.monthlyPrice = payload.price;
        }
        if (payload.yearlyPrice === undefined) {
            payload.yearlyPrice =
                payload.billingCycle === "yearly"
                    ? payload.price
                    : payload.price * 10; // Standard 2-month discount default
        }
    }
    const result = yield package_model_1.Package.create(payload);
    return result;
});
const getAllPackagesFromDB = (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (query = {}) {
    const filter = {
        isDeleted: { $ne: true },
    };
    if (query.isActive !== undefined) {
        filter.isActive = query.isActive === "true" || query.isActive === true;
    }
    if (query.billingCycle) {
        filter.billingCycle = query.billingCycle;
    }
    if (query.searchTerm) {
        filter.$or = [
            { name: { $regex: query.searchTerm, $options: "i" } },
            { description: { $regex: query.searchTerm, $options: "i" } },
        ];
    }
    const result = yield package_model_1.Package.find(filter).sort({ price: 1 });
    return result;
});
const getPackageByIdFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield package_model_1.Package.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!result) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Package not found");
    }
    return result;
});
const updatePackageIntoDB = (id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const isExist = yield package_model_1.Package.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!isExist) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Package not found");
    }
    // If name is changing, check uniqueness
    if (payload.name && payload.name.toLowerCase() !== isExist.name.toLowerCase()) {
        const duplicate = yield package_model_1.Package.findOne({
            _id: { $ne: id },
            name: { $regex: new RegExp(`^${payload.name}$`, "i") },
            isDeleted: { $ne: true },
        });
        if (duplicate) {
            throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Another package with this name already exists");
        }
    }
    // Handle trial period logic when updated
    if (payload.trialDays !== undefined) {
        if (payload.trialDays > 0) {
            payload.hasTrial = true;
        }
        else {
            payload.hasTrial = false;
            payload.trialDays = 0;
        }
    }
    else if (payload.hasTrial === false) {
        payload.trialDays = 0;
    }
    // Backward compatibility prices
    if (payload.price !== undefined) {
        payload.monthlyPrice = payload.price;
        if (payload.billingCycle === "yearly" || isExist.billingCycle === "yearly") {
            payload.yearlyPrice = payload.price;
        }
    }
    const result = yield package_model_1.Package.findByIdAndUpdate(id, payload, {
        new: true,
        runValidators: true,
    });
    return result;
});
const deletePackageFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const isExist = yield package_model_1.Package.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!isExist) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Package not found");
    }
    const result = yield package_model_1.Package.findByIdAndUpdate(id, { isDeleted: true, isActive: false }, { new: true });
    return result;
});
exports.PackageService = {
    createPackageIntoDB,
    getAllPackagesFromDB,
    getPackageByIdFromDB,
    updatePackageIntoDB,
    deletePackageFromDB,
};
