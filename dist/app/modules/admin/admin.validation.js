"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminValidation = void 0;
const zod_1 = require("zod");
const updateUserStatusZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        status: zod_1.z.enum(["active", "inactive", "suspended"], {
            required_error: "Status is required (active, inactive, or suspended)",
        }),
    }),
});
exports.AdminValidation = {
    updateUserStatusZodSchema,
};
