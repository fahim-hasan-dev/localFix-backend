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
exports.ServiceService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const http_status_codes_1 = require("http-status-codes");
const ApiErrors_1 = __importDefault(require("../../../errors/ApiErrors"));
const searchHelper_1 = require("../../../helpers/searchHelper");
const queryBuilder_1 = __importDefault(require("../../builder/queryBuilder"));
const category_model_1 = require("../category/category.model");
const service_model_1 = require("./service.model");
const professional_service_1 = require("../professional/professional.service");
const assertValidObjectId = (id, label = "service") => {
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Invalid ${label} ID`);
    }
};
const assertCategoryExists = (categoryId_1, ...args_1) => __awaiter(void 0, [categoryId_1, ...args_1], void 0, function* (categoryId, requireActive = false) {
    assertValidObjectId(categoryId, "category");
    const filter = {
        _id: categoryId,
        isDeleted: { $ne: true },
    };
    if (requireActive) {
        filter.isActive = true;
    }
    const category = yield category_model_1.Category.findOne(filter).lean();
    if (!category) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Selected category does not exist");
    }
    return category;
});
const getProfessionalsByCategoryFromDB = professional_service_1.ProfessionalService.getAllProfessionalsFromDB;
const getProfessionalDetailsFromDB = professional_service_1.ProfessionalService.getProfessionalDetailsFromDB;
const createServiceToDB = (professionalId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const trimmedName = payload.name.trim();
    const categoryId = payload.category.trim();
    const trimmedDescription = payload.description.trim();
    yield assertCategoryExists(categoryId);
    const existing = yield service_model_1.Service.findOne({
        professional: professionalId,
        name: new RegExp(`^${(0, searchHelper_1.escapeRegex)(trimmedName)}$`, "i"),
    });
    if (existing) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.CONFLICT, "You already have a service with this name");
    }
    const created = yield service_model_1.Service.create({
        professional: professionalId,
        name: trimmedName,
        category: categoryId,
        description: trimmedDescription,
    });
    return yield created.populate("category", "name icon coverImage");
});
const getMyServicesFromDB = (professionalId_1, ...args_1) => __awaiter(void 0, [professionalId_1, ...args_1], void 0, function* (professionalId, query = {}) {
    const normalizedQuery = Object.assign({}, query);
    if (normalizedQuery.search && !normalizedQuery.searchTerm) {
        normalizedQuery.searchTerm = normalizedQuery.search;
        delete normalizedQuery.search;
    }
    const queryBuilder = new queryBuilder_1.default(service_model_1.Service.find({ professional: professionalId }).populate("category", "name icon coverImage"), normalizedQuery)
        .search(["name", "description"])
        .filter()
        .sort();
    if (normalizedQuery.page || normalizedQuery.limit) {
        queryBuilder.paginate();
        const [data, meta] = yield Promise.all([
            queryBuilder.modelQuery.lean(),
            queryBuilder.countTotal(),
        ]);
        return { data, meta };
    }
    const data = yield queryBuilder.modelQuery.lean();
    return { data };
});
const getMyServiceByIdFromDB = (professionalId, id) => __awaiter(void 0, void 0, void 0, function* () {
    assertValidObjectId(id);
    const service = yield service_model_1.Service.findOne({
        _id: id,
        professional: professionalId,
    })
        .populate("category", "name icon coverImage")
        .lean();
    if (!service) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Service not found");
    }
    return service;
});
const updateMyServiceToDB = (professionalId, id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    assertValidObjectId(id);
    const existing = yield service_model_1.Service.findOne({
        _id: id,
        professional: professionalId,
    });
    if (!existing) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Service not found");
    }
    const updateData = {};
    if (payload.name !== undefined) {
        const trimmedName = payload.name.trim();
        const duplicate = yield service_model_1.Service.findOne({
            _id: { $ne: id },
            professional: professionalId,
            name: new RegExp(`^${(0, searchHelper_1.escapeRegex)(trimmedName)}$`, "i"),
        });
        if (duplicate) {
            throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.CONFLICT, "You already have a service with this name");
        }
        updateData.name = trimmedName;
    }
    if (payload.category !== undefined) {
        const categoryId = payload.category.trim();
        yield assertCategoryExists(categoryId);
        updateData.category = categoryId;
    }
    if (payload.description !== undefined) {
        updateData.description = payload.description.trim();
    }
    const updated = yield service_model_1.Service.findOneAndUpdate({ _id: id, professional: professionalId }, updateData, {
        new: true,
        runValidators: true,
    }).populate("category", "name icon coverImage");
    return updated;
});
const deleteMyServiceFromDB = (professionalId, id) => __awaiter(void 0, void 0, void 0, function* () {
    assertValidObjectId(id);
    const existing = yield service_model_1.Service.findOne({
        _id: id,
        professional: professionalId,
    });
    if (!existing) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Service not found");
    }
    const result = yield service_model_1.Service.softDeleteById(id);
    return result;
});
exports.ServiceService = {
    getProfessionalsByCategoryFromDB,
    getAllProfessionalsFromDB: getProfessionalsByCategoryFromDB,
    getProfessionalDetailsFromDB,
    createServiceToDB,
    getMyServicesFromDB,
    getMyServiceByIdFromDB,
    updateMyServiceToDB,
    deleteMyServiceFromDB,
};
