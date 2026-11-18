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
exports.seedDefaultPackages = exports.defaultPackages = void 0;
const colors_1 = __importDefault(require("colors"));
const package_model_1 = require("./package.model");
const logger_1 = require("../../../shared/logger");
exports.defaultPackages = [
    {
        name: "Basic",
        description: "Ideal for new professionals starting out and exploring local job requests.",
        price: 19,
        billingCycle: "monthly",
        leadLimit: 10,
        features: [
            "Send up to 10 quotes per month",
            "Accept direct homeowner job requests",
            "Standard verified profile listing",
            "In-app customer messaging & notifications",
            "14-day free trial included",
            "Standard customer support",
        ],
        hasTrial: true,
        trialDays: 14,
        isPopular: false,
        isActive: true,
        monthlyPrice: 19,
        yearlyPrice: 190,
    },
    {
        name: "Professional",
        description: "Best value for established professionals seeking consistent job flow and high visibility.",
        price: 49,
        billingCycle: "monthly",
        leadLimit: 35,
        features: [
            "Send up to 35 quotes per month",
            "Verified Pro badge on public profile",
            "Featured placement in search & category results",
            "Instant SMS & push notifications for urgent leads",
            "Showcase portfolio & customer reviews",
            "7-day free trial included",
            "Priority customer support",
        ],
        hasTrial: true,
        trialDays: 7,
        isPopular: true,
        isActive: true,
        monthlyPrice: 49,
        yearlyPrice: 490,
    },
    {
        name: "Enterprise",
        description: "Maximum lead volume and VIP features for high-performing contractors and local agencies.",
        price: 99,
        billingCycle: "monthly",
        leadLimit: -1, // Unlimited
        features: [
            "Unlimited quote submissions & lead responses",
            "Top search ranking & premium badge placement",
            "Background check verification badge display",
            "Priority access to emergency dispatch jobs",
            "Dedicated account manager",
            "24/7 VIP priority phone & chat support",
        ],
        hasTrial: false,
        trialDays: 0,
        isPopular: false,
        isActive: true,
        monthlyPrice: 99,
        yearlyPrice: 990,
    },
];
const seedDefaultPackages = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const count = yield package_model_1.Package.countDocuments({ isDeleted: { $ne: true } });
        if (count === 0) {
            for (const pkg of exports.defaultPackages) {
                yield package_model_1.Package.create(pkg);
            }
            logger_1.logger.info(colors_1.default.green("✔ Default subscription packages seeded successfully for LocalFix!"));
        }
    }
    catch (error) {
        logger_1.logger.error("Error seeding default packages:", error);
    }
});
exports.seedDefaultPackages = seedDefaultPackages;
