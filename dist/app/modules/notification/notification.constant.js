"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NOTIFICATION_REFERENCE_MODELS = exports.NOTIFICATION_TYPE = void 0;
var NOTIFICATION_TYPE;
(function (NOTIFICATION_TYPE) {
    NOTIFICATION_TYPE["SUPER_ADMIN"] = "super_admin";
    NOTIFICATION_TYPE["ADMIN"] = "admin";
    NOTIFICATION_TYPE["HOME_OWNER"] = "home_owner";
    NOTIFICATION_TYPE["PROFESSIONAL"] = "professional";
})(NOTIFICATION_TYPE || (exports.NOTIFICATION_TYPE = NOTIFICATION_TYPE = {}));
exports.NOTIFICATION_REFERENCE_MODELS = [
    "User",
    "Subscription",
    "Package",
    "Review",
    "Support",
    "Chat",
    "Message",
    "Category",
    "Banner",
    "Faq",
    "Rule",
    "Marquee",
    "SiteSettings",
    "Booking",
    "JobRequest",
    "Quotation",
];
