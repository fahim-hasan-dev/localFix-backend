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
exports.socketHelper = void 0;
const colors_1 = __importDefault(require("colors"));
const logger_1 = require("../shared/logger");
const jwtHelper_1 = require("./jwtHelper");
const config_1 = __importDefault(require("../config"));
const user_model_1 = require("../app/modules/user/user.model");
// One user can have the website open in more than one tab.
const socketMap = new Map();
const trackSocket = (userId, client) => {
    var _a;
    const key = userId.toString();
    const sockets = (_a = socketMap.get(key)) !== null && _a !== void 0 ? _a : new Set();
    sockets.add(client);
    socketMap.set(key, sockets);
    client.data = Object.assign(Object.assign({}, client.data), { userId: key });
};
const untrackSocket = (userId, client) => {
    const key = userId.toString();
    const sockets = socketMap.get(key);
    if (!sockets)
        return;
    sockets.delete(client);
    if (sockets.size === 0)
        socketMap.delete(key);
};
const socket = (io) => {
    io.on("connection", (socket) => __awaiter(void 0, void 0, void 0, function* () {
        logger_1.logger.info(colors_1.default.blue("A User connected to Socket.IO"));
        logger_1.logger.info(`Handshake Query: ${JSON.stringify(socket.handshake.query)}`);
        logger_1.logger.info(`Handshake Auth: ${JSON.stringify(socket.handshake.auth)}`);
        // Attempt authentication via token in query or auth object
        let queryToken = undefined;
        if (socket.handshake.query) {
            for (const key of Object.keys(socket.handshake.query)) {
                if (key.trim() === "token") {
                    queryToken = socket.handshake.query[key];
                    break;
                }
            }
        }
        let authToken = undefined;
        if (socket.handshake.auth) {
            for (const key of Object.keys(socket.handshake.auth)) {
                if (key.trim() === "token") {
                    authToken = socket.handshake.auth[key];
                    break;
                }
            }
        }
        let token = queryToken || authToken;
        if (token && token.startsWith("Bearer ")) {
            token = token.split(" ")[1];
        }
        logger_1.logger.info(`Extracted Token: ${token ? token.substring(0, 15) + "..." : "undefined"}`);
        if (token) {
            try {
                const decoded = jwtHelper_1.jwtHelper.verifyToken(token, config_1.default.jwt.jwt_secret);
                if (decoded && decoded.id) {
                    const userId = decoded.id.toString();
                    // Verify if the user exists in the database
                    const userExists = yield user_model_1.User.findById(userId);
                    if (!userExists) {
                        logger_1.logger.error(colors_1.default.red(`Socket authentication failed: User ${userId} does not exist in the database.`));
                        socket.disconnect();
                        return;
                    }
                    socket.data = { userId, role: decoded.role };
                    trackSocket(userId, socket);
                    logger_1.logger.info(colors_1.default.green(`Socket successfully authenticated for User: ${userId} (${decoded.role})`));
                }
            }
            catch (err) {
                logger_1.logger.error(colors_1.default.yellow(`Socket connection token verification failed: ${err.message}`));
            }
        }
        // Explicit registration event fallback
        socket.on("register", (data) => {
            if (data === null || data === void 0 ? void 0 : data.userId) {
                const userId = data.userId.toString();
                trackSocket(userId, socket);
                logger_1.logger.info(colors_1.default.green(`Socket manually registered User ID: ${userId}`));
            }
        });
        // disconnect
        socket.on("disconnect", (reason) => {
            var _a;
            const userId = (_a = socket.data) === null || _a === void 0 ? void 0 : _a.userId;
            if (userId) {
                untrackSocket(userId, socket);
                logger_1.logger.info(colors_1.default.red(`User ${userId} disconnected. Reason: ${reason}`));
            }
            else {
                logger_1.logger.info(colors_1.default.red(`A user disconnect. Reason: ${reason}`));
            }
        });
    }));
};
/**
 * Emit socket event to a specific user
 */
const sendToUser = (userId, event, data) => {
    if (!userId)
        return false;
    const key = userId.toString();
    const clients = socketMap.get(key);
    if (clients && clients.size > 0) {
        clients.forEach((clientSocket) => {
            clientSocket.emit(event, data);
        });
        logger_1.logger.info(colors_1.default.green(`Socket event '${event}' sent to user: ${key}`));
        return true;
    }
    logger_1.logger.warn(colors_1.default.yellow(`Socket event '${event}' FAILED - user ${key} not connected`));
    return false;
};
/**
 * Emit socket event to multiple users
 */
const sendToUsers = (userIds, event, data) => {
    for (const id of userIds) {
        sendToUser(id, event, data);
    }
};
// Reach every connected user with one of these roles, except ids already notified.
const sendToRoles = (roles, event, data, skip = new Set()) => {
    const wanted = new Set(roles);
    for (const [userId, clients] of socketMap) {
        if (skip.has(userId))
            continue;
        const matches = [...clients].some((client) => { var _a; return wanted.has(String(((_a = client.data) === null || _a === void 0 ? void 0 : _a.role) || "")); });
        if (!matches)
            continue;
        sendToUser(userId, `${event}::${userId}`, data);
    }
};
exports.socketHelper = {
    socket,
    sendToUser,
    sendToUsers,
    sendToRoles,
};
