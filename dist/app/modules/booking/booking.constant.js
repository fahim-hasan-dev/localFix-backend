"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bookingSearchableFields = exports.HISTORY_BOOKING_STATUSES = exports.ACTIVE_ON_SITE_STATUSES = exports.UPCOMING_BOOKING_STATUSES = exports.normalizePaymentMethod = exports.BOOKING_PAYMENT_STATUS = exports.BOOKING_PAYMENT_METHOD = exports.BOOKING_STATUS = void 0;
var BOOKING_STATUS;
(function (BOOKING_STATUS) {
    BOOKING_STATUS["SCHEDULED"] = "scheduled";
    BOOKING_STATUS["ON_THE_WAY"] = "on_the_way";
    BOOKING_STATUS["IN_PROGRESS"] = "in_progress";
    BOOKING_STATUS["PENDING_COMPLETION"] = "pending_completion";
    BOOKING_STATUS["COMPLETED"] = "completed";
    BOOKING_STATUS["CANCELLED"] = "cancelled";
    BOOKING_STATUS["DISPUTED"] = "disputed";
})(BOOKING_STATUS || (exports.BOOKING_STATUS = BOOKING_STATUS = {}));
var BOOKING_PAYMENT_METHOD;
(function (BOOKING_PAYMENT_METHOD) {
    BOOKING_PAYMENT_METHOD["CASH"] = "cash";
    BOOKING_PAYMENT_METHOD["BANK_TRANSFER"] = "bank_transfer";
    BOOKING_PAYMENT_METHOD["STRIPE"] = "stripe";
    BOOKING_PAYMENT_METHOD["CARD"] = "card";
    BOOKING_PAYMENT_METHOD["CHECK"] = "check";
    BOOKING_PAYMENT_METHOD["DIGITAL_WALLET"] = "digital_wallet";
    BOOKING_PAYMENT_METHOD["OTHER"] = "other";
})(BOOKING_PAYMENT_METHOD || (exports.BOOKING_PAYMENT_METHOD = BOOKING_PAYMENT_METHOD = {}));
var BOOKING_PAYMENT_STATUS;
(function (BOOKING_PAYMENT_STATUS) {
    BOOKING_PAYMENT_STATUS["PENDING"] = "pending";
    BOOKING_PAYMENT_STATUS["PAID"] = "paid";
    BOOKING_PAYMENT_STATUS["FAILED"] = "failed";
    BOOKING_PAYMENT_STATUS["REFUNDED"] = "refunded";
})(BOOKING_PAYMENT_STATUS || (exports.BOOKING_PAYMENT_STATUS = BOOKING_PAYMENT_STATUS = {}));
const normalizePaymentMethod = (val) => {
    if (typeof val !== "string")
        return BOOKING_PAYMENT_METHOD.CASH;
    const cleaned = val.trim().toLowerCase().replace(/[\s-]+/g, "_");
    if (cleaned === "cash")
        return BOOKING_PAYMENT_METHOD.CASH;
    if (cleaned === "bank_transfer" ||
        cleaned === "banktransfer" ||
        cleaned === "banktransfeer" ||
        cleaned === "bank_transfeer" ||
        cleaned === "wire_transfer") {
        return BOOKING_PAYMENT_METHOD.BANK_TRANSFER;
    }
    if (cleaned === "stripe")
        return BOOKING_PAYMENT_METHOD.STRIPE;
    if (cleaned === "card" ||
        cleaned === "credit_card" ||
        cleaned === "debit_card") {
        return BOOKING_PAYMENT_METHOD.CARD;
    }
    if (cleaned === "check" || cleaned === "cheque") {
        return BOOKING_PAYMENT_METHOD.CHECK;
    }
    if (cleaned === "digital_wallet" ||
        cleaned === "wallet" ||
        cleaned === "paypal" ||
        cleaned === "apple_pay" ||
        cleaned === "google_pay") {
        return BOOKING_PAYMENT_METHOD.DIGITAL_WALLET;
    }
    if (Object.values(BOOKING_PAYMENT_METHOD).includes(cleaned)) {
        return cleaned;
    }
    return BOOKING_PAYMENT_METHOD.OTHER;
};
exports.normalizePaymentMethod = normalizePaymentMethod;
exports.UPCOMING_BOOKING_STATUSES = [BOOKING_STATUS.SCHEDULED];
exports.ACTIVE_ON_SITE_STATUSES = [
    BOOKING_STATUS.ON_THE_WAY,
    BOOKING_STATUS.IN_PROGRESS,
    BOOKING_STATUS.PENDING_COMPLETION,
];
exports.HISTORY_BOOKING_STATUSES = [
    BOOKING_STATUS.COMPLETED,
    BOOKING_STATUS.CANCELLED,
];
exports.bookingSearchableFields = [
    "arrivalTimeWindow",
    "paymentMethod",
    "settledPaymentMethod",
    "paymentStatus",
    "contractorCompletionNote",
    "cancellationReason",
];
