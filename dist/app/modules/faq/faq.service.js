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
exports.FaqService = void 0;
const http_status_codes_1 = require("http-status-codes");
const faq_model_1 = require("./faq.model");
const mongoose_1 = __importDefault(require("mongoose"));
const ApiErrors_1 = __importDefault(require("../../../errors/ApiErrors"));
const queryBuilder_1 = __importDefault(require("../../builder/queryBuilder"));
const faq_constant_1 = require("./faq.constant");
const user_1 = require("../../../enums/user");
const createFaqToDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const role = payload.role
        ? (0, faq_constant_1.normalizeFaqRole)(payload.role)
        : user_1.USER_ROLES.HOME_OWNER;
    let order = payload.order;
    if (order === undefined) {
        const lastFaq = yield faq_model_1.Faq.findOne({ role }).sort({ order: -1 }).lean();
        order =
            lastFaq && typeof lastFaq.order === "number" ? lastFaq.order + 1 : 1;
    }
    const faq = yield faq_model_1.Faq.create(Object.assign(Object.assign({}, payload), { role,
        order }));
    if (!faq) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Failed to create Faq");
    }
    return faq;
});
const faqsFromDB = (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (query = {}) {
    var _a, _b;
    const queryObj = Object.assign({ sort: "order createdAt" }, query);
    // Support role, type, or category query aliases (e.g. ?role=customer, ?type=pro_contractor)
    const rawRole = (_b = (_a = queryObj.role) !== null && _a !== void 0 ? _a : queryObj.type) !== null && _b !== void 0 ? _b : queryObj.category;
    delete queryObj.type;
    delete queryObj.category;
    if (rawRole) {
        queryObj.role = (0, faq_constant_1.normalizeFaqRole)(rawRole);
    }
    const queryBuilder = new queryBuilder_1.default(faq_model_1.Faq.find(), queryObj)
        .search(faq_constant_1.faqSearchableFields)
        .filter()
        .sort();
    if (query.page || query.limit) {
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
const getFaqByIdFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Invalid ID");
    }
    const faq = yield faq_model_1.Faq.findById(id);
    if (!faq) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "No faq found by this ID");
    }
    return faq;
});
const updateFaqToDB = (id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Invalid ID");
    }
    if (payload.role) {
        payload.role = (0, faq_constant_1.normalizeFaqRole)(payload.role);
    }
    const updatedFaq = yield faq_model_1.Faq.findByIdAndUpdate({ _id: id }, payload, {
        new: true,
        runValidators: true,
    });
    if (!updatedFaq) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "No faq found by this ID");
    }
    return updatedFaq;
});
const deleteFaqToDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Invalid ID");
    }
    const result = yield faq_model_1.Faq.softDeleteById(id);
    if (!result) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "No faq found by this ID");
    }
    return result;
});
exports.FaqService = {
    createFaqToDB,
    faqsFromDB,
    getFaqByIdFromDB,
    updateFaqToDB,
    deleteFaqToDB,
};
