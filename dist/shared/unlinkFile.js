"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const unlinkFile = (file) => {
    if (!file)
        return;
    const cleanFile = file.replace(/^[/\\]?uploads[/\\]?/, "");
    const filePath = path_1.default.join(process.cwd(), "uploads", cleanFile);
    if (fs_1.default.existsSync(filePath)) {
        try {
            fs_1.default.unlinkSync(filePath);
        }
        catch (_a) {
            // Ignore error if file cannot be removed
        }
    }
};
exports.default = unlinkFile;
