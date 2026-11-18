"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatValidation = void 0;
const zod_1 = require("zod");
const createChatValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        participant: zod_1.z
            .string({ required_error: "Participant ID is required" })
            .min(1, "Participant ID is required"),
    }),
});
exports.chatValidation = {
    createChatValidationSchema,
};
