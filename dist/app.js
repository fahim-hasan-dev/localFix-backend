"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_status_codes_1 = require("http-status-codes");
const morgan_1 = require("./shared/morgan");
const globalErrorHandler_1 = __importDefault(require("./app/middlewares/globalErrorHandler"));
const path_1 = __importDefault(require("path"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const yamljs_1 = __importDefault(require("yamljs"));
const routes_1 = __importDefault(require("./app/routes"));
const webhook_routes_1 = require("./app/modules/webhook/webhook.routes");
const requestContextMiddleware_1 = require("./app/middlewares/requestContextMiddleware");
const app = (0, express_1.default)();
app.use(requestContextMiddleware_1.requestContextMiddleware);
app.set("views", path_1.default.join(__dirname, "..", "views"));
app.set("view engine", "ejs");
// morgan
app.use(morgan_1.Morgan.successHandler);
app.use(morgan_1.Morgan.errorHandler);
//body parser
app.use((0, cors_1.default)({
    origin: [
        "http://10.10.26.182:3000",
        "http://10.10.26.182:3001",
        "http://10.10.26.182:3002",
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:3003",
        "https://fahim5003.naimulhassan.me",
        "https://fahim5004.naimulhassan.me",
        "http://fahim5003.naimulhassan.me",
        "http://fahim5004.naimulhassan.me"
    ],
    credentials: true,
}));
app.use(express_1.default.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    },
}));
app.use(express_1.default.urlencoded({ extended: true }));
//file retrieve
app.use("/uploads", express_1.default.static(path_1.default.join(__dirname, "..", "uploads")));
// swagger docs
try {
    const swaggerDocument = yamljs_1.default.load(path_1.default.join(__dirname, "..", "docs", "swagger", "index.yaml"));
    app.use("/api-docs", swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swaggerDocument));
}
catch (error) {
    console.log("Swagger documentation file not found. Skipping swagger UI setup.");
}
// webhooks
app.use("/webhook", webhook_routes_1.WebhookRoutes);
//router
app.use("/api/v1", routes_1.default);
app.get("/", (req, res) => {
    res.send("Server is running...");
});
// handle not found route
app.use((req, res) => {
    res.status(http_status_codes_1.StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Not Found",
        errorMessages: [
            {
                path: req.originalUrl,
                message: "API DOESN'T EXIST",
            },
        ],
    });
});
//global error handle
app.use(globalErrorHandler_1.default);
exports.default = app;
