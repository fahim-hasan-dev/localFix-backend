import express from "express";
import auth from "../../middlewares/auth";
import optionalAuth from "../../middlewares/optionalAuth";
import { USER_ROLES } from "../../../enums/user";
import { ProfessionalController } from "./professional.controller";

const router = express.Router();

router.get("/", optionalAuth(), ProfessionalController.getAllProfessionals);

router.get(
  "/top-rated",
  optionalAuth(),
  ProfessionalController.getTopRatedProfessionals,
);

router.get(
  "/analytics",
  auth(USER_ROLES.PROFESSIONAL, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  ProfessionalController.getProfessionalAnalytics,
);

router.get(
  "/analytics/history",
  auth(USER_ROLES.PROFESSIONAL, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  ProfessionalController.getProfessionalHistory,
);

router.get(
  "/application",
  auth(USER_ROLES.PROFESSIONAL, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  ProfessionalController.getProfessionalApplication,
);

router.get(
  "/:professionalId",
  optionalAuth(),
  ProfessionalController.getProfessionalDetails,
);

export const ProfessionalRoutes = router;
