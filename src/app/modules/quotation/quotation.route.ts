import express from "express";
import {
  isAuthenticated,
  isHomeOwner,
  isProfessional,
} from "../../../helpers/authHelper";
import validateRequest from "../../middlewares/validateRequest";
import { checkQuotationLimit } from "../../middlewares/checkSubscriptionLimit";
import { QuotationController } from "./quotation.controller";
import { QuotationValidation } from "./quotation.validation";
import { JobRequestController } from "../jobRequest/jobRequest.controller";

const router = express.Router();

router
  .route("/")
  .post(
    isProfessional,
    checkQuotationLimit,
    validateRequest(QuotationValidation.createQuotationZodSchema),
    QuotationController.createQuotation,
  )
  .get(isAuthenticated, QuotationController.getAllQuotations);

router.get(
  "/my-proposals",
  isProfessional,
  JobRequestController.getMyProposals,
);

router.get("/:id", isAuthenticated, QuotationController.getQuotationById);

router.patch(
  "/:id/accept",
  isHomeOwner,
  validateRequest(QuotationValidation.acceptQuotationZodSchema),
  QuotationController.acceptQuotation,
);

// Decline quotation using DELETE method
router.delete(
  "/:id/decline",
  isHomeOwner,
  validateRequest(QuotationValidation.declineQuotationZodSchema),
  QuotationController.declineQuotation,
);

router.delete(
  "/:id/reject",
  isHomeOwner,
  validateRequest(QuotationValidation.declineQuotationZodSchema),
  QuotationController.declineQuotation,
);

export const QuotationRoutes = router;
