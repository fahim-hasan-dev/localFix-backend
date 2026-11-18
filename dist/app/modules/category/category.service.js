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
exports.CategoryService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const http_status_codes_1 = require("http-status-codes");
const user_1 = require("../../../enums/user");
const ApiErrors_1 = __importDefault(require("../../../errors/ApiErrors"));
const searchHelper_1 = require("../../../helpers/searchHelper");
const unlinkFile_1 = __importDefault(require("../../../shared/unlinkFile"));
const queryBuilder_1 = __importDefault(require("../../builder/queryBuilder"));
const category_model_1 = require("./category.model");
const isAdminRole = (role) => role === user_1.USER_ROLES.ADMIN || role === user_1.USER_ROLES.SUPER_ADMIN;
const cleanupFiles = (payload) => {
    if (payload.coverImage)
        (0, unlinkFile_1.default)(payload.coverImage);
    if (payload.icon)
        (0, unlinkFile_1.default)(payload.icon);
};
const assertValidObjectId = (id) => {
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Invalid category ID");
    }
};
const createCategoryToDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const trimmedName = (_a = payload.name) === null || _a === void 0 ? void 0 : _a.trim();
    if (!trimmedName) {
        cleanupFiles(payload);
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Category name is required");
    }
    const existing = yield category_model_1.Category.findOne({
        name: new RegExp(`^${(0, searchHelper_1.escapeRegex)(trimmedName)}$`, "i"),
    });
    if (existing) {
        cleanupFiles(payload);
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.CONFLICT, "Category already exists");
    }
    return yield category_model_1.Category.create(Object.assign(Object.assign({}, payload), { name: trimmedName }));
});
const getAllCategoriesFromDB = (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (query = {}, userRole) {
    const normalizedQuery = Object.assign({}, query);
    const baseFilter = {};
    if (!isAdminRole(userRole)) {
        baseFilter.isActive = true;
        delete normalizedQuery.isActive;
    }
    const queryBuilder = new queryBuilder_1.default(category_model_1.Category.find(baseFilter), normalizedQuery)
        .search(["name"])
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
const getCategoryByIdFromDB = (id, userRole) => __awaiter(void 0, void 0, void 0, function* () {
    assertValidObjectId(id);
    const category = yield category_model_1.Category.findById(id).lean();
    if (!category || (!isAdminRole(userRole) && !category.isActive)) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Category not found");
    }
    return category;
});
const updateCategoryToDB = (id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        cleanupFiles(payload);
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Invalid category ID");
    }
    const existing = yield category_model_1.Category.findById(id);
    if (!existing) {
        cleanupFiles(payload);
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Category not found");
    }
    if (payload.name) {
        const trimmedName = payload.name.trim();
        const duplicate = yield category_model_1.Category.findOne({
            _id: { $ne: id },
            name: new RegExp(`^${(0, searchHelper_1.escapeRegex)(trimmedName)}$`, "i"),
        });
        if (duplicate) {
            cleanupFiles(payload);
            throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.CONFLICT, "Category already exists");
        }
        payload.name = trimmedName;
    }
    if (payload.coverImage && existing.coverImage) {
        (0, unlinkFile_1.default)(existing.coverImage);
    }
    if (payload.icon && existing.icon) {
        (0, unlinkFile_1.default)(existing.icon);
    }
    const updated = yield category_model_1.Category.findByIdAndUpdate(id, payload, {
        new: true,
        runValidators: true,
    });
    return updated;
});
const deleteCategoryFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    assertValidObjectId(id);
    const existing = yield category_model_1.Category.findById(id);
    if (!existing) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Category not found");
    }
    cleanupFiles(existing);
    const result = yield category_model_1.Category.softDeleteById(id);
    return result;
});
exports.CategoryService = {
    createCategoryToDB,
    getAllCategoriesFromDB,
    getCategoryByIdFromDB,
    updateCategoryToDB,
    deleteCategoryFromDB,
};
