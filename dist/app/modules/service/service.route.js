"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceRoutes = void 0;
const express_1 = __importDefault(require("express"));
const authHelper_1 = require("../../../helpers/authHelper");
const optionalAuth_1 = __importDefault(require("../../middlewares/optionalAuth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const service_controller_1 = require("./service.controller");
const service_validation_1 = require("./service.validation");
const router = express_1.default.Router();
router.get("/professionals", (0, optionalAuth_1.default)(), service_controller_1.ServiceController.getProfessionalsByCategory);
router.get("/professionals/:professionalId", (0, optionalAuth_1.default)(), service_controller_1.ServiceController.getProfessionalDetails);
router
    .route("/")
    .post(authHelper_1.isProfessional, (0, validateRequest_1.default)(service_validation_1.ServiceValidation.createServiceZodSchema), service_controller_1.ServiceController.createService)
    .get(authHelper_1.isProfessional, service_controller_1.ServiceController.getMyServices);
router
    .route("/:id")
    .get(authHelper_1.isProfessional, service_controller_1.ServiceController.getMyServiceById)
    .patch(authHelper_1.isProfessional, (0, validateRequest_1.default)(service_validation_1.ServiceValidation.updateServiceZodSchema), service_controller_1.ServiceController.updateMyService)
    .delete(authHelper_1.isProfessional, service_controller_1.ServiceController.deleteMyService);
exports.ServiceRoutes = router;
