"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const user_routes_1 = require("../modules/user/user.routes");
const auth_routes_1 = require("../modules/auth/auth.routes");
const rule_route_1 = require("../modules/rule/rule.route");
const faq_route_1 = require("../modules/faq/faq.route");
const chat_routes_1 = require("../modules/chat/chat.routes");
const message_routes_1 = require("../modules/message/message.routes");
const contactUs_route_1 = require("../modules/contactUs/contactUs.route");
const banner_route_1 = require("../modules/banner/banner.route");
const notification_routes_1 = require("../modules/notification/notification.routes");
const fcmToken_route_1 = require("../modules/fcmToken/fcmToken.route");
const webhook_routes_1 = require("../modules/webhook/webhook.routes");
const package_routes_1 = require("../modules/package/package.routes");
const subscription_routes_1 = require("../modules/subscription/subscription.routes");
const admin_routes_1 = require("../modules/admin/admin.routes");
const review_routes_1 = require("../modules/review/review.routes");
const category_route_1 = require("../modules/category/category.route");
const checkr_route_1 = require("../modules/checkr/checkr.route");
const marquee_route_1 = require("../modules/marquee/marquee.route");
const siteSettings_route_1 = require("../modules/siteSettings/siteSettings.route");
const service_route_1 = require("../modules/service/service.route");
const professional_route_1 = require("../modules/professional/professional.route");
const jobRequest_route_1 = require("../modules/jobRequest/jobRequest.route");
const favorite_route_1 = require("../modules/favorite/favorite.route");
const supportTicket_route_1 = require("../modules/supportTicket/supportTicket.route");
const quotation_route_1 = require("../modules/quotation/quotation.route");
const booking_route_1 = require("../modules/booking/booking.route");
const order_routes_1 = require("../modules/order/order.routes");
const router = express_1.default.Router();
const apiRoutes = [
    {
        path: "/users",
        route: user_routes_1.UserRoutes,
    },
    {
        path: "/auth",
        route: auth_routes_1.AuthRoutes,
    },
    {
        path: "/rules",
        route: rule_route_1.RuleRoutes,
    },
    {
        path: "/faqs",
        route: faq_route_1.FaqRoutes,
    },
    {
        path: "/chats",
        route: chat_routes_1.ChatRoutes,
    },
    {
        path: "/messages",
        route: message_routes_1.MessageRoutes,
    },
    {
        path: "/contact",
        route: contactUs_route_1.ContactUsRoutes,
    },
    {
        path: "/banners",
        route: banner_route_1.BannerRoutes,
    },
    {
        path: "/notifications",
        route: notification_routes_1.NotificationRoutes,
    },
    {
        path: "/fcmTokens",
        route: fcmToken_route_1.FcmTokenRoutes,
    },
    {
        path: "/webhook",
        route: webhook_routes_1.WebhookRoutes,
    },
    {
        path: "/packages",
        route: package_routes_1.PackageRoutes,
    },
    {
        path: "/subscriptions",
        route: subscription_routes_1.SubscriptionRoutes,
    },
    {
        path: "/admin",
        route: admin_routes_1.AdminRoutes,
    },
    {
        path: "/reviews",
        route: review_routes_1.ReviewRoutes,
    },
    {
        path: "/categories",
        route: category_route_1.CategoryRoutes,
    },
    {
        path: "/checkr",
        route: checkr_route_1.CheckrRoutes,
    },
    {
        path: "/marquees",
        route: marquee_route_1.MarqueeRoutes,
    },
    {
        path: "/site-settings",
        route: siteSettings_route_1.SiteSettingsRoutes,
    },
    {
        path: "/services",
        route: service_route_1.ServiceRoutes,
    },
    {
        path: "/professionals",
        route: professional_route_1.ProfessionalRoutes,
    },
    {
        path: "/jobs",
        route: jobRequest_route_1.JobRequestRoutes,
    },
    {
        path: "/favorites",
        route: favorite_route_1.FavoriteRoutes,
    },
    {
        path: "/support-tickets",
        route: supportTicket_route_1.SupportTicketRoutes,
    },
    {
        path: "/quotations",
        route: quotation_route_1.QuotationRoutes,
    },
    {
        path: "/bookings",
        route: booking_route_1.BookingRoutes,
    },
    {
        path: "/admin/orders",
        route: order_routes_1.OrderRoutes,
    },
];
apiRoutes.forEach((route) => router.use(route.path, route.route));
exports.default = router;
