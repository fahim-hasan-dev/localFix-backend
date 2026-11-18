"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfessionalRoutes = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../../middlewares/auth"));
const optionalAuth_1 = __importDefault(require("../../middlewares/optionalAuth"));
const user_1 = require("../../../enums/user");
const professional_controller_1 = require("./professional.controller");
const router = express_1.default.Router();
router.get("/", (0, optionalAuth_1.default)(), professional_controller_1.ProfessionalController.getAllProfessionals);
router.get("/top-rated", (0, optionalAuth_1.default)(), professional_controller_1.ProfessionalController.getTopRatedProfessionals);
router.get("/analytics", (0, auth_1.default)(user_1.USER_ROLES.PROFESSIONAL, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), professional_controller_1.ProfessionalController.getProfessionalAnalytics);
router.get("/analytics/history", (0, auth_1.default)(user_1.USER_ROLES.PROFESSIONAL, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), professional_controller_1.ProfessionalController.getProfessionalHistory);
router.get("/application", (0, auth_1.default)(user_1.USER_ROLES.PROFESSIONAL, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), professional_controller_1.ProfessionalController.getProfessionalApplication);
router.get("/:professionalId", (0, optionalAuth_1.default)(), professional_controller_1.ProfessionalController.getProfessionalDetails);
exports.ProfessionalRoutes = router;
