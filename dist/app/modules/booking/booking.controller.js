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
exports.BookingController = void 0;
const http_status_codes_1 = require("http-status-codes");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const booking_service_1 = require("./booking.service");
const getMyBookings = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = req.user.id;
    const userRole = (_a = req.user) === null || _a === void 0 ? void 0 : _a.role;
    const result = yield booking_service_1.BookingService.getMyBookingsFromDB(userId, userRole, req.query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Bookings retrieved successfully",
        meta: Object.assign(Object.assign({}, result.meta), { activeTab: result.activeTab, tabCounts: result.tabCounts }),
        data: result.data,
    });
}));
const getBookingById = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = req.user.id;
    const userRole = (_a = req.user) === null || _a === void 0 ? void 0 : _a.role;
    const result = yield booking_service_1.BookingService.getBookingByIdFromDB(req.params.id, userId, userRole);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Booking details retrieved successfully",
        data: result,
    });
}));
const rescheduleBooking = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const result = yield booking_service_1.BookingService.rescheduleBookingToDB(req.params.id, userId, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Booking rescheduled successfully",
        data: result,
    });
}));
const cancelBooking = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const result = yield booking_service_1.BookingService.cancelBookingToDB(req.params.id, userId, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Booking cancelled successfully",
        data: result,
    });
}));
const onTheWay = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const result = yield booking_service_1.BookingService.onTheWayToDB(req.params.id, userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Contractor status updated to On The Way",
        data: result,
    });
}));
const startWork = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const result = yield booking_service_1.BookingService.startWorkToDB(req.params.id, userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Work marked as started on site",
        data: result,
    });
}));
const completeWork = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const result = yield booking_service_1.BookingService.completeWorkToDB(req.params.id, userId, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Contractor marked work as completed",
        data: result,
    });
}));
const confirmCompletion = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const result = yield booking_service_1.BookingService.confirmCompletionToDB(req.params.id, userId, req.body);
    const isStripe = (result === null || result === void 0 ? void 0 : result.requiresPayment) && (result === null || result === void 0 ? void 0 : result.paymentUrl);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: isStripe
            ? "Stripe checkout session created. Please complete payment via the provided payment URL."
            : "Work completion and direct payment confirmed successfully",
        data: result,
    });
}));
const verifyPayment = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const result = yield booking_service_1.BookingService.verifyBookingPaymentToDB(req.params.id, userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Booking payment status verified successfully",
        data: result,
    });
}));
exports.BookingController = {
    getMyBookings,
    getBookingById,
    rescheduleBooking,
    cancelBooking,
    onTheWay,
    startWork,
    completeWork,
    confirmCompletion,
    verifyPayment,
};
