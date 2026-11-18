import express from "express";
import {
  isAuthenticated,
  isHomeOwner,
  isProfessional,
} from "../../../helpers/authHelper";
import fileUploadHandler from "../../middlewares/flieUploadHandler";
import { parseFileData } from "../../middlewares/parseFileData";
import validateRequest from "../../middlewares/validateRequest";
import { JobRequestController } from "./jobRequest.controller";
import { JobRequestValidation } from "./jobRequest.validation";

const router = express.Router();

const uploadJobPhotos = [
  fileUploadHandler(["projectPhotos"]),
  parseFileData({ fieldName: "projectPhotos", mode: "multiple" }),
];

// Quote requests tab counts for professionals
router.get(
  "/tabs-count",
  isProfessional,
  JobRequestController.getQuoteRequestsCount,
);

// My Proposals route for professionals
router.get(
  "/my-proposals",
  isProfessional,
  JobRequestController.getMyProposals,
);

// Direct requests routes for professionals
router.get(
  "/direct-requests",
  isProfessional,
  JobRequestController.getDirectRequests,
);

router.get(
  "/direct-requests/:id",
  isProfessional,
  JobRequestController.getSingleDirectRequest,
);

router.delete(
  "/direct-requests/:id/reject",
  isProfessional,
  JobRequestController.rejectDirectRequest,
);

// Marketplace leads routes for professionals
router.get(
  "/marketplace-leads",
  isProfessional,
  JobRequestController.getMarketplaceLeads,
);

router.get(
  "/marketplace-leads/:id",
  isProfessional,
  JobRequestController.getSingleMarketplaceLead,
);

router.delete(
  "/marketplace-leads/:id/reject",
  isProfessional,
  JobRequestController.rejectMarketplaceLead,
);

// Rejection route by job request ID
router.delete(
  "/:id/reject",
  isProfessional,
  JobRequestController.rejectJobRequest,
);

router
  .route("/")
  .post(
    isHomeOwner,
    ...uploadJobPhotos,
    validateRequest(JobRequestValidation.createJobRequestZodSchema),
    JobRequestController.createJobRequest,
  )
  .get(isHomeOwner, JobRequestController.getMyJobRequests);

router.get("/my-requests", isHomeOwner, JobRequestController.getMyJobRequests);

router
  .route("/:id")
  .get(isAuthenticated, JobRequestController.getJobRequestById)
  .patch(
    isHomeOwner,
    ...uploadJobPhotos,
    validateRequest(JobRequestValidation.updateJobRequestZodSchema),
    JobRequestController.updateJobRequest,
  )
  .delete(isHomeOwner, JobRequestController.deleteJobRequest);

export const JobRequestRoutes = router;
