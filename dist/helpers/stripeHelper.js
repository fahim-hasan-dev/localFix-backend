"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStripe = void 0;
const stripe_1 = __importDefault(require("stripe"));
const config_1 = __importDefault(require("../config"));
const ApiErrors_1 = __importDefault(require("../errors/ApiErrors"));
const http_status_codes_1 = require("http-status-codes");
let stripeInstance = null;
const getStripe = () => {
    var _a;
    const secretKey = ((_a = config_1.default.stripe) === null || _a === void 0 ? void 0 : _a.secretKey) || process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, "Stripe secret key missing on server");
    }
    if (!stripeInstance) {
        stripeInstance = new stripe_1.default(secretKey);
    }
    return stripeInstance;
};
exports.getStripe = getStripe;
