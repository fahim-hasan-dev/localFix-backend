export enum BOOKING_STATUS {
  SCHEDULED = "scheduled",
  ON_THE_WAY = "on_the_way",
  IN_PROGRESS = "in_progress",
  PENDING_COMPLETION = "pending_completion",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
  DISPUTED = "disputed",
}

export enum BOOKING_PAYMENT_METHOD {
  CASH = "cash",
  BANK_TRANSFER = "bank_transfer",
  STRIPE = "stripe",
  CARD = "card",
  CHECK = "check",
  DIGITAL_WALLET = "digital_wallet",
  OTHER = "other",
}

export enum BOOKING_PAYMENT_STATUS {
  PENDING = "pending",
  PAID = "paid",
  FAILED = "failed",
  REFUNDED = "refunded",
}

export const normalizePaymentMethod = (val: unknown): BOOKING_PAYMENT_METHOD => {
  if (typeof val !== "string") return BOOKING_PAYMENT_METHOD.CASH;
  const cleaned = val.trim().toLowerCase().replace(/[\s-]+/g, "_");

  if (cleaned === "cash") return BOOKING_PAYMENT_METHOD.CASH;
  if (
    cleaned === "bank_transfer" ||
    cleaned === "banktransfer" ||
    cleaned === "banktransfeer" ||
    cleaned === "bank_transfeer" ||
    cleaned === "wire_transfer"
  ) {
    return BOOKING_PAYMENT_METHOD.BANK_TRANSFER;
  }
  if (cleaned === "stripe") return BOOKING_PAYMENT_METHOD.STRIPE;
  if (
    cleaned === "card" ||
    cleaned === "credit_card" ||
    cleaned === "debit_card"
  ) {
    return BOOKING_PAYMENT_METHOD.CARD;
  }
  if (cleaned === "check" || cleaned === "cheque") {
    return BOOKING_PAYMENT_METHOD.CHECK;
  }
  if (
    cleaned === "digital_wallet" ||
    cleaned === "wallet" ||
    cleaned === "paypal" ||
    cleaned === "apple_pay" ||
    cleaned === "google_pay"
  ) {
    return BOOKING_PAYMENT_METHOD.DIGITAL_WALLET;
  }
  if (Object.values(BOOKING_PAYMENT_METHOD).includes(cleaned as any)) {
    return cleaned as BOOKING_PAYMENT_METHOD;
  }
  return BOOKING_PAYMENT_METHOD.OTHER;
};

export const UPCOMING_BOOKING_STATUSES = [BOOKING_STATUS.SCHEDULED];

export const ACTIVE_ON_SITE_STATUSES = [
  BOOKING_STATUS.ON_THE_WAY,
  BOOKING_STATUS.IN_PROGRESS,
  BOOKING_STATUS.PENDING_COMPLETION,
];

export const HISTORY_BOOKING_STATUSES = [
  BOOKING_STATUS.COMPLETED,
  BOOKING_STATUS.CANCELLED,
];

export const bookingSearchableFields = [
  "arrivalTimeWindow",
  "paymentMethod",
  "settledPaymentMethod",
  "paymentStatus",
  "contractorCompletionNote",
  "cancellationReason",
];
