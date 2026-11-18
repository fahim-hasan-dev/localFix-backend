import express from "express";
import auth from "../../middlewares/auth";
import { USER_ROLES } from "../../../enums/user";
import { AdminController } from "../admin/admin.controller";

const router = express.Router();

// Order details: /api/v1/orders/:id
router.get(
  "/:id",
  auth(
    USER_ROLES.ADMIN,
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.HOME_OWNER,
    USER_ROLES.PROFESSIONAL,
  ),
  AdminController.getAdminOrderById,
);

export const OrderRoutes = router;
