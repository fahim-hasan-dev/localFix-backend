import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { SubscriptionService } from "./subscription.service";

const createCheckoutSession = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.user.id;
    const { packageId, planType } = req.body;

    const result = await SubscriptionService.createCheckoutSession(
      userId,
      packageId,
      planType,
    );

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "Subscription checkout session created successfully",
      data: result,
    });
  },
);

const updateSubscriptionPlan = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.user.id;
    const { packageId, planType } = req.body;

    const result = await SubscriptionService.updateSubscriptionPlan(
      userId,
      packageId,
      planType,
    );

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: result.message,
      data: result,
    });
  },
);

const cancelUpcomingPlan = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const result = await SubscriptionService.cancelUpcomingPlan(userId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: result.message,
    data: result.subscription,
  });
});

const getMySubscription = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const result = await SubscriptionService.getMySubscriptionFromDB(userId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Subscription details fetched successfully",
    data: result,
  });
});

const createCustomerPortalSession = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.user.id;
    const result =
      await SubscriptionService.createCustomerPortalSession(userId);

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "Customer portal session created successfully",
      data: result,
    });
  },
);

const cancelSubscription = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;

  const result = await SubscriptionService.cancelSubscription(userId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: result.message,
    data: result.subscription,
  });
});

const getAllSubscriptions = catchAsync(async (req: Request, res: Response) => {
  const result = await SubscriptionService.getAllSubscriptionsFromDB(req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Subscriptions fetched successfully",
    meta: result.meta,
    data: result.data,
  });
});

export const SubscriptionController = {
  createCheckoutSession,
  updateSubscriptionPlan,
  cancelUpcomingPlan,
  getMySubscription,
  createCustomerPortalSession,
  cancelSubscription,
  getAllSubscriptions,
};
