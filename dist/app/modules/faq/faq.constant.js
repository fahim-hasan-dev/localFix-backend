"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeFaqRole = exports.FAQ_ROLES = exports.faqSearchableFields = void 0;
const user_1 = require("../../../enums/user");
exports.faqSearchableFields = ["question", "answer"];
exports.FAQ_ROLES = [
    user_1.USER_ROLES.HOME_OWNER,
    user_1.USER_ROLES.PROFESSIONAL,
];
const normalizeFaqRole = (role) => {
    if (!role || typeof role !== "string")
        return undefined;
    const cleaned = role
        .toLowerCase()
        .trim()
        .replace(/[\s-]+/g, "_");
    if (cleaned === "home_owner" ||
        cleaned === "homeowner" ||
        cleaned === "homeowners" ||
        cleaned === "customer" ||
        cleaned === "customers" ||
        cleaned === "customer_faq" ||
        cleaned === "customer_faqs")
        return user_1.USER_ROLES.HOME_OWNER;
    if (cleaned === "professional" ||
        cleaned === "professionals" ||
        cleaned === "pro" ||
        cleaned === "pros" ||
        cleaned === "contractor" ||
        cleaned === "contractors" ||
        cleaned === "pro_contractor" ||
        cleaned === "pro_contractors" ||
        cleaned === "pro_contractor_faq" ||
        cleaned === "pro_contractor_faqs")
        return user_1.USER_ROLES.PROFESSIONAL;
    return cleaned;
};
exports.normalizeFaqRole = normalizeFaqRole;
