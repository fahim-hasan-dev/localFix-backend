"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationRoutes = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../../middlewares/auth"));
const user_1 = require("../../../enums/user");
const notification_controller_1 = require("./notification.controller");
const router = express_1.default.Router();
const allRoles = [
    user_1.USER_ROLES.HOME_OWNER,
    user_1.USER_ROLES.PROFESSIONAL,
    user_1.USER_ROLES.ADMIN,
    user_1.USER_ROLES.SUPER_ADMIN,
];
// user notification collection routes
router
    .route("/")
    .get((0, auth_1.default)(...allRoles), notification_controller_1.NotificationController.getNotificationFromDB)
    .patch((0, auth_1.default)(...allRoles), notification_controller_1.NotificationController.readNotification)
    .delete((0, auth_1.default)(...allRoles), notification_controller_1.NotificationController.deleteNotification);
// admin routes
router
    .route("/admin")
    .get((0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), notification_controller_1.NotificationController.adminNotificationFromDB)
    .patch((0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), notification_controller_1.NotificationController.adminReadNotification)
    .delete((0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), notification_controller_1.NotificationController.adminDeleteNotification);
router
    .route("/admin/:id")
    .get((0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), notification_controller_1.NotificationController.adminGetSingleNotification)
    .delete((0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), notification_controller_1.NotificationController.adminDeleteSingleNotification);
router.patch("/admin/:id/read", (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), notification_controller_1.NotificationController.adminReadSingleNotification);
// user single routes
router
    .route("/:id")
    .get((0, auth_1.default)(...allRoles), notification_controller_1.NotificationController.getSingleNotification)
    .delete((0, auth_1.default)(...allRoles), notification_controller_1.NotificationController.deleteSingleNotification);
router.patch("/:id/read", (0, auth_1.default)(...allRoles), notification_controller_1.NotificationController.readSingleNotification);
exports.NotificationRoutes = router;
