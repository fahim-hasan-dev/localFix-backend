"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FavoriteValidation = void 0;
const zod_1 = require("zod");
const toggleFavoriteZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        referenceId: zod_1.z.string().optional(),
        id: zod_1.z.string().optional(),
    }),
});
exports.FavoriteValidation = {
    toggleFavoriteZodSchema,
};
