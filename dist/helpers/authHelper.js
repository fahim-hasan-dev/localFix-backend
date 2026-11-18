"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAuthenticated = exports.isSuperAdmin = exports.isAdmin = exports.isHomeOwnerOrProfessional = exports.isProfessional = exports.isHomeOwner = void 0;
const auth_1 = __importDefault(require("../app/middlewares/auth"));
const user_1 = require("../enums/user");
exports.isHomeOwner = (0, auth_1.default)(user_1.USER_ROLES.HOME_OWNER);
exports.isProfessional = (0, auth_1.default)(user_1.USER_ROLES.PROFESSIONAL);
exports.isHomeOwnerOrProfessional = (0, auth_1.default)(user_1.USER_ROLES.HOME_OWNER, user_1.USER_ROLES.PROFESSIONAL);
exports.isAdmin = (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN);
exports.isSuperAdmin = (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN);
exports.isAuthenticated = (0, auth_1.default)(user_1.USER_ROLES.HOME_OWNER, user_1.USER_ROLES.PROFESSIONAL, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN);
