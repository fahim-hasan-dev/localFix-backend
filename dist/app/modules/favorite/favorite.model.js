"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Favorite = void 0;
const mongoose_1 = require("mongoose");
const favoriteSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    referenceId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
}, {
    timestamps: true,
    versionKey: false,
});
favoriteSchema.index({ userId: 1, referenceId: 1 }, { unique: true });
favoriteSchema.index({ referenceId: 1 });
exports.Favorite = (0, mongoose_1.model)("Favorite", favoriteSchema);
