"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarqueeSetting = exports.Marquee = void 0;
const mongoose_1 = require("mongoose");
const softDeletePlugin_1 = require("../../../DB/plugins/softDeletePlugin");
const marqueeSchema = new mongoose_1.Schema({
    keyword: {
        type: String,
        required: true,
        trim: true,
    },
    isEnabled: {
        type: Boolean,
        default: true,
    },
    order: {
        type: Number,
        default: 0,
    },
}, {
    timestamps: true,
    versionKey: false,
});
marqueeSchema.index({ keyword: 1 });
marqueeSchema.index({ order: 1 });
marqueeSchema.plugin(softDeletePlugin_1.softDeletePlugin);
exports.Marquee = (0, mongoose_1.model)("Marquee", marqueeSchema);
const marqueeSettingSchema = new mongoose_1.Schema({
    isEnabled: {
        type: Boolean,
        default: true,
    },
}, {
    timestamps: true,
    versionKey: false,
});
exports.MarqueeSetting = (0, mongoose_1.model)("MarqueeSetting", marqueeSettingSchema);
