"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FavoriteRoutes = void 0;
const express_1 = __importDefault(require("express"));
const authHelper_1 = require("../../../helpers/authHelper");
const favorite_controller_1 = require("./favorite.controller");
const router = express_1.default.Router();
// Toggle favorite (supports body: { referenceId } or route param)
router.post("/toggle", authHelper_1.isHomeOwnerOrProfessional, favorite_controller_1.FavoriteController.toggleFavorite);
router.post("/toggle/:referenceId", authHelper_1.isHomeOwnerOrProfessional, favorite_controller_1.FavoriteController.toggleFavorite);
router.post("/:referenceId", authHelper_1.isHomeOwnerOrProfessional, favorite_controller_1.FavoriteController.toggleFavorite);
// Get all favorites for current user
router.get("/", authHelper_1.isHomeOwnerOrProfessional, favorite_controller_1.FavoriteController.getFavorites);
// Check if a professional is favorited
router.get("/status/:referenceId", authHelper_1.isHomeOwnerOrProfessional, favorite_controller_1.FavoriteController.checkFavoriteStatus);
// Get single favorite by ID or professional referenceId
router.get("/:id", authHelper_1.isHomeOwnerOrProfessional, favorite_controller_1.FavoriteController.getSingleFavorite);
// Remove favorite
router.delete("/:referenceId", authHelper_1.isHomeOwnerOrProfessional, favorite_controller_1.FavoriteController.deleteFavorite);
exports.FavoriteRoutes = router;
