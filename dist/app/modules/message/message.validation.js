"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messageValidation = void 0;
const zod_1 = require("zod");
const sendMessageValidationSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        text: zod_1.z.string().optional(),
        image: zod_1.z.string().optional(),
    })
        .refine((data) => data.text || data.image, {
        message: "Either text or image must be provided",
        path: ["text"],
    }),
});
const pinUnpinMessageValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        action: zod_1.z.enum(["pin", "unpin"], {
            required_error: "action is required and must be 'pin' or 'unpin'",
        }),
    }),
});
exports.messageValidation = {
    sendMessageValidationSchema,
    pinUnpinMessageValidationSchema,
};
