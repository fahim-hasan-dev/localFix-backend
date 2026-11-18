"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const colors_1 = __importDefault(require("colors"));
const user_model_1 = require("../app/modules/user/user.model");
const config_1 = __importDefault(require("../config"));
const user_1 = require("../enums/user");
const logger_1 = require("../shared/logger");
const package_seed_1 = require("../app/modules/package/package.seed");
const superUser = {
    name: "Super Admin",
    role: user_1.USER_ROLES.SUPER_ADMIN,
    email: config_1.default.admin.email,
    password: config_1.default.admin.password,
    verified: true,
    phone: "+1234567890",
    countryCode: "+1",
};
const seedSuperAdmin = () => __awaiter(void 0, void 0, void 0, function* () {
    const existingUser = yield user_model_1.User.findOne({
        email: config_1.default.admin.email,
    });
    if (!existingUser) {
        yield user_model_1.User.create(superUser);
        logger_1.logger.info(colors_1.default.green("✔ Super admin created successfully!"));
    }
    else if (existingUser.role !== user_1.USER_ROLES.SUPER_ADMIN) {
        existingUser.role = user_1.USER_ROLES.SUPER_ADMIN;
        existingUser.verified = true;
        if (!existingUser.phone) {
            existingUser.phone = "+1234567890";
        }
        if (!existingUser.countryCode) {
            existingUser.countryCode = "+1";
        }
        yield existingUser.save();
        logger_1.logger.info(colors_1.default.yellow("✔ Existing user promoted to Super Admin!"));
    }
    else {
        logger_1.logger.info(colors_1.default.cyan("✔ Super Admin already exists."));
    }
    // Seed default subscription packages for LocalFix
    yield (0, package_seed_1.seedDefaultPackages)();
});
exports.default = seedSuperAdmin;
