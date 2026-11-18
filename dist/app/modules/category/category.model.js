"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Category = void 0;
const mongoose_1 = require("mongoose");
const softDeletePlugin_1 = require("../../../DB/plugins/softDeletePlugin");
const categorySchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    coverImage: {
        type: String,
        required: false,
        default: "",
    },
    icon: {
        type: String,
        required: false,
        default: "",
    },
    isActive: {
        type: Boolean,
        default: true,
    },
}, {
    timestamps: true,
    versionKey: false,
});
categorySchema.plugin(softDeletePlugin_1.softDeletePlugin);
categorySchema.index({ name: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });
exports.Category = (0, mongoose_1.model)("Category", categorySchema);
