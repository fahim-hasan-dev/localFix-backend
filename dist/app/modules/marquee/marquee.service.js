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
exports.MarqueeService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const http_status_codes_1 = require("http-status-codes");
const ApiErrors_1 = __importDefault(require("../../../errors/ApiErrors"));
const queryBuilder_1 = __importDefault(require("../../builder/queryBuilder"));
const marquee_model_1 = require("./marquee.model");
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const createMarqueeToDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const keyword = (_a = payload.keyword) === null || _a === void 0 ? void 0 : _a.trim();
    if (!keyword) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Service keyword is required");
    }
    const existingKeyword = yield marquee_model_1.Marquee.findOne({
        keyword: { $regex: `^${escapeRegExp(keyword)}$`, $options: "i" },
    });
    if (existingKeyword) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.CONFLICT, "Service keyword already exists in marquee");
    }
    let order = payload.order;
    if (order === undefined) {
        const lastItem = yield marquee_model_1.Marquee.findOne().sort({ order: -1 }).lean();
        order =
            lastItem && typeof lastItem.order === "number" ? lastItem.order + 1 : 1;
    }
    const marquee = yield marquee_model_1.Marquee.create({
        keyword,
        isEnabled: (_b = payload.isEnabled) !== null && _b !== void 0 ? _b : true,
        order,
    });
    if (!marquee) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Failed to create marquee keyword");
    }
    return marquee;
});
const getMarqueesFromDB = (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (query = {}) {
    const queryObj = Object.assign({ sort: "order createdAt" }, query);
    const queryBuilder = new queryBuilder_1.default(marquee_model_1.Marquee.find(), queryObj)
        .search(["keyword"])
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
const getMarqueeByIdFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Invalid ID");
    }
    const marquee = yield marquee_model_1.Marquee.findById(id).lean();
    if (!marquee) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "No marquee keyword found by this ID");
    }
    return marquee;
});
const updateMarqueeToDB = (id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Invalid ID");
    }
    const updateData = Object.assign({}, payload);
    if (updateData.keyword !== undefined) {
        const trimmedKeyword = updateData.keyword.trim();
        const duplicate = yield marquee_model_1.Marquee.findOne({
            _id: { $ne: id },
            keyword: { $regex: `^${escapeRegExp(trimmedKeyword)}$`, $options: "i" },
        });
        if (duplicate) {
            throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.CONFLICT, "Service keyword already exists in marquee");
        }
        updateData.keyword = trimmedKeyword;
    }
    const updatedMarquee = yield marquee_model_1.Marquee.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
    });
    if (!updatedMarquee) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "No marquee keyword found by this ID");
    }
    return updatedMarquee;
});
const deleteMarqueeFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Invalid ID");
    }
    const result = yield marquee_model_1.Marquee.softDeleteById(id);
    if (!result) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "No marquee keyword found by this ID");
    }
    return result;
});
const getMarqueeStatusFromDB = () => __awaiter(void 0, void 0, void 0, function* () {
    let setting = yield marquee_model_1.MarqueeSetting.findOne().lean();
    if (!setting) {
        setting = (yield marquee_model_1.MarqueeSetting.create({ isEnabled: true })).toObject();
    }
    return setting;
});
const toggleMarqueeStatusToDB = (isEnabled) => __awaiter(void 0, void 0, void 0, function* () {
    let setting = yield marquee_model_1.MarqueeSetting.findOne();
    if (!setting) {
        setting = yield marquee_model_1.MarqueeSetting.create({
            isEnabled: isEnabled !== undefined ? isEnabled : true,
        });
        return setting;
    }
    setting.isEnabled = isEnabled !== undefined ? isEnabled : !setting.isEnabled;
    yield setting.save();
    return setting;
});
exports.MarqueeService = {
    createMarqueeToDB,
    getMarqueesFromDB,
    getMarqueeByIdFromDB,
    updateMarqueeToDB,
    deleteMarqueeFromDB,
    getMarqueeStatusFromDB,
    toggleMarqueeStatusToDB,
};
