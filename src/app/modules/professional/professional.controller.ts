import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { ProfessionalService } from "./professional.service";
import ApiError from "../../../errors/ApiErrors";
import { USER_ROLES } from "../../../enums/user";

const getAllProfessionals = catchAsync(async (req: Request, res: Response) => {
  const currentUserId =
    (req.user as any)?.id ||
    (req.user as any)?.userId ||
    (req.user as any)?._id;
  const result = await ProfessionalService.getAllProfessionalsFromDB(
    req.query,
    currentUserId,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Professionals retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getTopRatedProfessionals = catchAsync(
  async (req: Request, res: Response) => {
    const currentUserId =
      (req.user as any)?.id ||
      (req.user as any)?.userId ||
      (req.user as any)?._id;
    const result = await ProfessionalService.getTopRatedProfessionalsFromDB(
      req.query,
      currentUserId,
    );

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "Top-rated professionals retrieved successfully",
      meta: result.meta,
      data: result.data,
    });
  },
);

const getProfessionalDetails = catchAsync(
  async (req: Request, res: Response) => {
    const currentUserId =
      (req.user as any)?.id ||
      (req.user as any)?.userId ||
      (req.user as any)?._id;
    const result = await ProfessionalService.getProfessionalDetailsFromDB(
      req.params.professionalId,
      currentUserId,
    );

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "Professional details retrieved successfully",
      data: result,
    });
  },
);

const getProfessionalAnalytics = catchAsync(
  async (req: Request, res: Response) => {
    const user = req.user as any;
    let targetProfessionalId = user?.id || user?.userId || user?._id;

    // If an Admin/Super Admin is accessing and provides a specific professionalId, use it
    if (
      (user?.role === USER_ROLES.ADMIN ||
        user?.role === USER_ROLES.SUPER_ADMIN) &&
      req.query.professionalId
    ) {
      targetProfessionalId = req.query.professionalId as string;
    }

    if (!targetProfessionalId) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Professional ID is required",
      );
    }

    const result = await ProfessionalService.getProfessionalAnalyticsFromDB(
      targetProfessionalId,
      req.query,
    );

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "Professional analytics retrieved successfully",
      data: result,
    });
  },
);

const getProfessionalHistory = catchAsync(
  async (req: Request, res: Response) => {
    const user = req.user as any;
    let targetProfessionalId = user?.id || user?.userId || user?._id;

    // If an Admin/Super Admin is accessing and provides a specific professionalId, use it
    if (
      (user?.role === USER_ROLES.ADMIN ||
        user?.role === USER_ROLES.SUPER_ADMIN) &&
      req.query.professionalId
    ) {
      targetProfessionalId = req.query.professionalId as string;
    }

    if (!targetProfessionalId) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Professional ID is required",
      );
    }

    const result = await ProfessionalService.getProfessionalHistoryFromDB(
      targetProfessionalId,
      req.query,
    );

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "Professional job history retrieved successfully",
      meta: result.meta,
      data: result.data,
    });
  },
);

const getProfessionalApplication = catchAsync(
  async (req: Request, res: Response) => {
    const user = req.user as any;
    let targetProfessionalId = user?.id || user?.userId || user?._id;

    // If an Admin/Super Admin is accessing and provides a specific professionalId, use it
    if (
      (user?.role === USER_ROLES.ADMIN ||
        user?.role === USER_ROLES.SUPER_ADMIN) &&
      req.query.professionalId
    ) {
      targetProfessionalId = req.query.professionalId as string;
    }

    if (!targetProfessionalId) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Professional ID is required",
      );
    }

    const result =
      await ProfessionalService.getProfessionalApplicationFromDB(
        targetProfessionalId,
      );

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "Professional application details retrieved successfully",
      data: result,
    });
  },
);

export const ProfessionalController = {
  getAllProfessionals,
  getTopRatedProfessionals,
  getProfessionalDetails,
  getProfessionalAnalytics,
  getProfessionalHistory,
  getProfessionalApplication,
};
