"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookService = void 0;
const http_status_codes_1 = require("http-status-codes");
const stripe_1 = __importDefault(require("stripe"));
const config_1 = __importDefault(require("../../../config"));
const ApiErrors_1 = __importDefault(require("../../../errors/ApiErrors"));
const subscription_service_1 = require("../subscription/subscription.service");
const booking_service_1 = require("../booking/booking.service");
const handleStripeWebhookIntoDB = (rawBody, signature) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
    const secretKey = ((_a = config_1.default.stripe) === null || _a === void 0 ? void 0 : _a.secretKey) || process.env.STRIPE_SECRET_KEY;
    const webhookSecret = ((_b = config_1.default.stripe) === null || _b === void 0 ? void 0 : _b.webhookSecret) || process.env.STRIPE_WEBHOOK_SECRET;
    if (!secretKey) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, "Stripe secret key missing on server");
    }
    const stripe = new stripe_1.default(secretKey);
    let event;
    if (webhookSecret && signature) {
        try {
            event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
        }
        catch (err) {
            throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Webhook signature verification failed: ${err.message}`);
        }
    }
    else {
        try {
            event =
                typeof rawBody === "string"
                    ? JSON.parse(rawBody)
                    : JSON.parse(rawBody.toString("utf-8"));
        }
        catch (err) {
            throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Invalid webhook payload");
        }
    }
    // Handle Event Types
    switch (event.type) {
        case "checkout.session.completed": {
            const session = event.data.object;
            const paymentType = (_c = session.metadata) === null || _c === void 0 ? void 0 : _c.paymentType;
            if (paymentType === "subscription" || session.mode === "subscription") {
                yield subscription_service_1.SubscriptionService.handleSubscriptionCheckoutCompleted(session);
            }
            else if (paymentType === "booking_payment" ||
                Boolean((_d = session.metadata) === null || _d === void 0 ? void 0 : _d.bookingId)) {
                yield booking_service_1.BookingService.handleBookingPaymentCompleted(session);
            }
            break;
        }
        case "invoice.payment_succeeded": {
            const invoice = event.data.object;
            yield subscription_service_1.SubscriptionService.handleInvoicePaymentSucceeded(invoice);
            break;
        }
        case "invoice.payment_failed": {
            const invoice = event.data.object;
            yield subscription_service_1.SubscriptionService.handleInvoicePaymentFailed(invoice);
            break;
        }
        case "customer.subscription.updated": {
            const subscription = event.data.object;
            yield subscription_service_1.SubscriptionService.handleSubscriptionUpdated(subscription);
            break;
        }
        case "customer.subscription.deleted": {
            const subscription = event.data.object;
            yield subscription_service_1.SubscriptionService.handleSubscriptionDeleted(subscription);
            break;
        }
        case "customer.subscription.trial_will_end": {
            const subscription = event.data.object;
            yield subscription_service_1.SubscriptionService.handleTrialWillEnd(subscription);
            break;
        }
        case "payment_intent.succeeded": {
            const paymentIntent = event.data.object;
            if ((_e = paymentIntent.metadata) === null || _e === void 0 ? void 0 : _e.bookingId) {
                yield booking_service_1.BookingService.handlePaymentIntentSucceeded(paymentIntent);
            }
            break;
        }
        default:
            break;
    }
    return { received: true };
});
exports.WebhookService = {
    handleStripeWebhookIntoDB,
};
