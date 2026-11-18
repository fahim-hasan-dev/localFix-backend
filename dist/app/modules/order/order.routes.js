"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderRoutes = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../../middlewares/auth"));
const user_1 = require("../../../enums/user");
const admin_controller_1 = require("../admin/admin.controller");
const router = express_1.default.Router();
// Order details: /api/v1/orders/:id
router.get("/:id", (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.HOME_OWNER, user_1.USER_ROLES.PROFESSIONAL), admin_controller_1.AdminController.getAdminOrderById);
exports.OrderRoutes = router;
