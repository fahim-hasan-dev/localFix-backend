"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobRequestRoutes = void 0;
const express_1 = __importDefault(require("express"));
const authHelper_1 = require("../../../helpers/authHelper");
const flieUploadHandler_1 = __importDefault(require("../../middlewares/flieUploadHandler"));
const parseFileData_1 = require("../../middlewares/parseFileData");
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const jobRequest_controller_1 = require("./jobRequest.controller");
const jobRequest_validation_1 = require("./jobRequest.validation");
const router = express_1.default.Router();
const uploadJobPhotos = [
    (0, flieUploadHandler_1.default)(["projectPhotos"]),
    (0, parseFileData_1.parseFileData)({ fieldName: "projectPhotos", mode: "multiple" }),
];
// Quote requests tab counts for professionals
router.get("/tabs-count", authHelper_1.isProfessional, jobRequest_controller_1.JobRequestController.getQuoteRequestsCount);
// My Proposals route for professionals
router.get("/my-proposals", authHelper_1.isProfessional, jobRequest_controller_1.JobRequestController.getMyProposals);
// Direct requests routes for professionals
router.get("/direct-requests", authHelper_1.isProfessional, jobRequest_controller_1.JobRequestController.getDirectRequests);
router.get("/direct-requests/:id", authHelper_1.isProfessional, jobRequest_controller_1.JobRequestController.getSingleDirectRequest);
router.delete("/direct-requests/:id/reject", authHelper_1.isProfessional, jobRequest_controller_1.JobRequestController.rejectDirectRequest);
// Marketplace leads routes for professionals
router.get("/marketplace-leads", authHelper_1.isProfessional, jobRequest_controller_1.JobRequestController.getMarketplaceLeads);
router.get("/marketplace-leads/:id", authHelper_1.isProfessional, jobRequest_controller_1.JobRequestController.getSingleMarketplaceLead);
router.delete("/marketplace-leads/:id/reject", authHelper_1.isProfessional, jobRequest_controller_1.JobRequestController.rejectMarketplaceLead);
// Rejection route by job request ID
router.delete("/:id/reject", authHelper_1.isProfessional, jobRequest_controller_1.JobRequestController.rejectJobRequest);
router
    .route("/")
    .post(authHelper_1.isHomeOwner, ...uploadJobPhotos, (0, validateRequest_1.default)(jobRequest_validation_1.JobRequestValidation.createJobRequestZodSchema), jobRequest_controller_1.JobRequestController.createJobRequest)
    .get(authHelper_1.isHomeOwner, jobRequest_controller_1.JobRequestController.getMyJobRequests);
router.get("/my-requests", authHelper_1.isHomeOwner, jobRequest_controller_1.JobRequestController.getMyJobRequests);
router
    .route("/:id")
    .get(authHelper_1.isAuthenticated, jobRequest_controller_1.JobRequestController.getJobRequestById)
    .patch(authHelper_1.isHomeOwner, ...uploadJobPhotos, (0, validateRequest_1.default)(jobRequest_validation_1.JobRequestValidation.updateJobRequestZodSchema), jobRequest_controller_1.JobRequestController.updateJobRequest)
    .delete(authHelper_1.isHomeOwner, jobRequest_controller_1.JobRequestController.deleteJobRequest);
exports.JobRequestRoutes = router;
