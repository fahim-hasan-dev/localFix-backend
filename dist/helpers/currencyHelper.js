"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatMonthlyPrice = exports.formatCurrency = exports.getCurrencySymbol = exports.getCurrencyCodeUpper = exports.getCurrencyCode = void 0;
const config_1 = __importDefault(require("../config"));
/**
 * Returns the lowercase currency code (e.g., "usd", "gbp")
 * Sourced dynamically from .env CURRENCY
 */
const getCurrencyCode = () => {
    return (config_1.default.currency || process.env.CURRENCY || "usd").toLowerCase();
};
exports.getCurrencyCode = getCurrencyCode;
/**
 * Returns the uppercase currency code (e.g., "USD", "GBP")
 * Sourced dynamically from .env CURRENCY
 */
const getCurrencyCodeUpper = () => {
    return (config_1.default.currency_code || process.env.CURRENCY || "USD").toUpperCase();
};
exports.getCurrencyCodeUpper = getCurrencyCodeUpper;
/**
 * Returns the currency symbol based on .env configuration or a specific currency code
 */
const getCurrencySymbol = (currency) => {
    if (!currency && process.env.CURRENCY_SYMBOL) {
        return process.env.CURRENCY_SYMBOL;
    }
    const curr = (currency ||
        process.env.CURRENCY ||
        config_1.default.currency ||
        "usd").toLowerCase();
    switch (curr) {
        case "gbp":
            return "£";
        case "eur":
            return "€";
        case "usd":
            return "$";
        case "bdt":
            return "৳";
        case "inr":
            return "₹";
        case "cad":
            return "CA$";
        case "aud":
            return "A$";
        case "jpy":
            return "¥";
        case "cny":
            return "¥";
        default:
            return process.env.CURRENCY_SYMBOL || config_1.default.currency_symbol || "$";
    }
};
exports.getCurrencySymbol = getCurrencySymbol;
/**
 * Formats a numeric amount with the currency symbol and localized number formatting
 * e.g., formatCurrency(2450) -> "$2,450"
 */
const formatCurrency = (amount, symbol = (0, exports.getCurrencySymbol)()) => {
    return `${symbol}${Number(amount || 0).toLocaleString("en-US")}`;
};
exports.formatCurrency = formatCurrency;
/**
 * Formats a monthly price into "$19/mo" or "Free"
 */
const formatMonthlyPrice = (price, symbol = (0, exports.getCurrencySymbol)()) => {
    const p = Number(price || 0);
    return p > 0 ? `${symbol}${p.toLocaleString("en-US")}/mo` : "Free";
};
exports.formatMonthlyPrice = formatMonthlyPrice;
