"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarqueeRoutes = void 0;
const express_1 = __importDefault(require("express"));
const authHelper_1 = require("../../../helpers/authHelper");
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const marquee_controller_1 = require("./marquee.controller");
const marquee_validation_1 = require("./marquee.validation");
const router = express_1.default.Router();
router
    .route("/status")
    .get(marquee_controller_1.MarqueeController.getMarqueeStatus)
    .patch(authHelper_1.isAdmin, (0, validateRequest_1.default)(marquee_validation_1.MarqueeValidation.toggleMarqueeStatusZodSchema), marquee_controller_1.MarqueeController.toggleMarqueeStatus);
router
    .route("/")
    .post(authHelper_1.isAdmin, (0, validateRequest_1.default)(marquee_validation_1.MarqueeValidation.createMarqueeZodSchema), marquee_controller_1.MarqueeController.createMarquee)
    .get(marquee_controller_1.MarqueeController.getMarquees);
router
    .route("/:id")
    .get(marquee_controller_1.MarqueeController.getMarqueeById)
    .patch(authHelper_1.isAdmin, (0, validateRequest_1.default)(marquee_validation_1.MarqueeValidation.updateMarqueeZodSchema), marquee_controller_1.MarqueeController.updateMarquee)
    .delete(authHelper_1.isAdmin, marquee_controller_1.MarqueeController.deleteMarquee);
exports.MarqueeRoutes = router;
