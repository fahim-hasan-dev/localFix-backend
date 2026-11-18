"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectionOptions = exports.QUEUE_NAMES = void 0;
const index_1 = __importDefault(require("./index"));
// BullMQ connection options
const connectionOptions = {
    host: index_1.default.redis_host || "localhost",
    port: parseInt(index_1.default.redis_port || "6379"),
    password: index_1.default.redis_password,
    db: parseInt(index_1.default.redis_db || "0"),
};
exports.connectionOptions = connectionOptions;
// Queue names
exports.QUEUE_NAMES = {};
