import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { QuotationService } from "./quotation.service";

const createQuotation = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const result = await QuotationService.createQuotationToDB(userId, req.body);

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: "Quotation submitted successfully",
    data: result,
  });
});

const getQuotationById = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const userRole = (req.user as { role?: string } | undefined)?.role;

  const result = await QuotationService.getQuotationByIdFromDB(
    req.params.id,
    userId,
    userRole,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Quotation details retrieved successfully",
    data: result,
  });
});

const acceptQuotation = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const result = await QuotationService.acceptQuotationToDB(
    req.params.id,
    userId,
    req.body,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Quotation accepted and booking confirmed successfully",
    data: result,
  });
});

const declineQuotation = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const result = await QuotationService.declineQuotationToDB(
    req.params.id,
    userId,
    req.body,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Quotation declined successfully",
    data: result,
  });
});

const getAllQuotations = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const userRole = (req.user as { role?: string } | undefined)?.role;

  const result = await QuotationService.getAllQuotationsFromDB(
    req.query,
    userId,
    userRole,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Quotations retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

export const QuotationController = {
  createQuotation,
  getQuotationById,
  acceptQuotation,
  declineQuotation,
  getAllQuotations,
};
