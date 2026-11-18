import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { BookingService } from "./booking.service";

const getMyBookings = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const userRole = (req.user as { role?: string } | undefined)?.role;

  const result = await BookingService.getMyBookingsFromDB(
    userId,
    userRole,
    req.query,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Bookings retrieved successfully",
    meta: {
      ...result.meta,
      activeTab: result.activeTab,
      tabCounts: result.tabCounts,
    },
    data: result.data,
  });
});

const getBookingById = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const userRole = (req.user as { role?: string } | undefined)?.role;

  const result = await BookingService.getBookingByIdFromDB(
    req.params.id,
    userId,
    userRole,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Booking details retrieved successfully",
    data: result,
  });
});

const rescheduleBooking = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const result = await BookingService.rescheduleBookingToDB(
    req.params.id,
    userId,
    req.body,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Booking rescheduled successfully",
    data: result,
  });
});

const cancelBooking = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const result = await BookingService.cancelBookingToDB(
    req.params.id,
    userId,
    req.body,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Booking cancelled successfully",
    data: result,
  });
});

const onTheWay = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const result = await BookingService.onTheWayToDB(req.params.id, userId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Contractor status updated to On The Way",
    data: result,
  });
});

const startWork = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const result = await BookingService.startWorkToDB(req.params.id, userId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Work marked as started on site",
    data: result,
  });
});

const completeWork = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const result = await BookingService.completeWorkToDB(
    req.params.id,
    userId,
    req.body,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Contractor marked work as completed",
    data: result,
  });
});

const confirmCompletion = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const result = await BookingService.confirmCompletionToDB(
    req.params.id,
    userId,
    req.body,
  );

  const isStripe =
    (result as any)?.requiresPayment && (result as any)?.paymentUrl;

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: isStripe
      ? "Stripe checkout session created. Please complete payment via the provided payment URL."
      : "Work completion and direct payment confirmed successfully",
    data: result,
  });
});

const verifyPayment = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const result = await BookingService.verifyBookingPaymentToDB(
    req.params.id,
    userId,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Booking payment status verified successfully",
    data: result,
  });
});

export const BookingController = {
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
