"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Service = void 0;
const mongoose_1 = require("mongoose");
const softDeletePlugin_1 = require("../../../DB/plugins/softDeletePlugin");
const serviceSchema = new mongoose_1.Schema({
    professional: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
    },
    category: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Category",
        required: true,
        index: true,
    },
    description: {
        type: String,
        required: true,
        trim: true,
    },
}, {
    timestamps: true,
    versionKey: false,
});
serviceSchema.plugin(softDeletePlugin_1.softDeletePlugin);
serviceSchema.index({ professional: 1, name: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });
exports.Service = (0, mongoose_1.model)("Service", serviceSchema);
