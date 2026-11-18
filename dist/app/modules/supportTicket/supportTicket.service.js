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
exports.SupportTicketServices = void 0;
const mongoose_1 = require("mongoose");
const http_status_codes_1 = require("http-status-codes");
const ApiErrors_1 = __importDefault(require("../../../errors/ApiErrors"));
const user_1 = require("../../../enums/user");
const queryBuilder_1 = __importDefault(require("../../builder/queryBuilder"));
const user_model_1 = require("../user/user.model");
const supportTicket_constant_1 = require("./supportTicket.constant");
const supportTicket_model_1 = require("./supportTicket.model");
const realtime_socket_1 = require("../realtime/realtime.socket");
// Helper to find ticket by ObjectId or ticketId (e.g. TIK-1001)
const findTicketByIdOrCustomId = (idOrCustomId) => {
    const isObjectId = mongoose_1.Types.ObjectId.isValid(idOrCustomId);
    const filter = isObjectId
        ? {
            $or: [
                { _id: new mongoose_1.Types.ObjectId(idOrCustomId) },
                { ticketId: idOrCustomId.toUpperCase() },
            ],
        }
        : { ticketId: idOrCustomId.toUpperCase() };
    return supportTicket_model_1.SupportTicket.findOne(filter);
};
// 1. Create Support Ticket (Admin, Homeowner, Professional)
const createSupportTicketInDB = (userId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield user_model_1.User.isExistUserById(userId);
    if (!user) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "User not found");
    }
    payload.requester = new mongoose_1.Types.ObjectId(userId);
    // Auto-fill requester details from authenticated user if not explicitly supplied
    if (!payload.requesterName) {
        payload.requesterName = user.name || "User";
    }
    if (!payload.requesterEmail) {
        payload.requesterEmail = user.email || "";
    }
    if (!payload.requesterRole) {
        payload.requesterRole = user.role;
    }
    // Generate sequential ticket ID (TIK-1001, TIK-1002...)
    const lastTicket = yield supportTicket_model_1.SupportTicket.findOne({}, { ticketId: 1 })
        .sort({ createdAt: -1 })
        .lean();
    let nextNumber = 1001;
    if (lastTicket && lastTicket.ticketId) {
        const match = lastTicket.ticketId.match(/\d+/);
        if (match && match[0]) {
            const parsed = parseInt(match[0], 10);
            if (!isNaN(parsed)) {
                nextNumber = parsed + 1;
            }
        }
    }
    payload.ticketId = `TIK-${nextNumber}`;
    const createdTicket = yield supportTicket_model_1.SupportTicket.create(payload);
    realtime_socket_1.realtimeSocket.ticket({
        ticketId: createdTicket._id,
        requesterId: userId,
        action: "created",
        status: createdTicket.status,
    });
    return createdTicket;
});
// 2. Get All Support Tickets (Admin sees all; Homeowner & Pro see only their own)
const getAllSupportTicketsFromDB = (user, query) => __awaiter(void 0, void 0, void 0, function* () {
    const isAdminUser = user.role === user_1.USER_ROLES.ADMIN || user.role === user_1.USER_ROLES.SUPER_ADMIN;
    // Filter scoped to user if not admin
    if (!isAdminUser) {
        query.requester = user.id;
    }
    const baseQuery = supportTicket_model_1.SupportTicket.find()
        .populate({
        path: "requester",
        select: "_id firstName lastName name email phone role profileImage",
    })
        .populate({
        path: "assignedAdmin",
        select: "_id firstName lastName name email role profileImage",
    });
    const queryBuilder = new queryBuilder_1.default(baseQuery, query)
        .search(supportTicket_constant_1.SUPPORT_TICKET_SEARCHABLE_FIELDS)
        .filter()
        .sort()
        .paginate()
        .fields();
    const [data, meta] = yield Promise.all([
        queryBuilder.modelQuery.lean(),
        queryBuilder.countTotal(),
    ]);
    // Compute card statistics
    const statsFilter = isAdminUser
        ? {}
        : { requester: new mongoose_1.Types.ObjectId(user.id) };
    const [totalTickets, openTickets, inProgressTickets, resolvedClosedTickets] = yield Promise.all([
        supportTicket_model_1.SupportTicket.countDocuments(Object.assign({}, statsFilter)),
        supportTicket_model_1.SupportTicket.countDocuments(Object.assign(Object.assign({}, statsFilter), { status: supportTicket_constant_1.SUPPORT_TICKET_STATUS.OPEN })),
        supportTicket_model_1.SupportTicket.countDocuments(Object.assign(Object.assign({}, statsFilter), { status: supportTicket_constant_1.SUPPORT_TICKET_STATUS.IN_PROGRESS })),
        supportTicket_model_1.SupportTicket.countDocuments(Object.assign(Object.assign({}, statsFilter), { status: {
                $in: [supportTicket_constant_1.SUPPORT_TICKET_STATUS.RESOLVED, supportTicket_constant_1.SUPPORT_TICKET_STATUS.CLOSED],
            } })),
    ]);
    const stats = {
        totalTickets,
        openTickets,
        inProgressTickets,
        resolvedClosedTickets,
    };
    return {
        data: data || [],
        meta,
        stats,
    };
});
// 3. Get Support Ticket Statistics (Admin cards)
const getSupportTicketStatsFromDB = (user) => __awaiter(void 0, void 0, void 0, function* () {
    const isAdminUser = user.role === user_1.USER_ROLES.ADMIN || user.role === user_1.USER_ROLES.SUPER_ADMIN;
    const statsFilter = isAdminUser
        ? {}
        : { requester: new mongoose_1.Types.ObjectId(user.id) };
    const [totalTickets, openTickets, inProgressTickets, resolvedClosedTickets] = yield Promise.all([
        supportTicket_model_1.SupportTicket.countDocuments(Object.assign({}, statsFilter)),
        supportTicket_model_1.SupportTicket.countDocuments(Object.assign(Object.assign({}, statsFilter), { status: supportTicket_constant_1.SUPPORT_TICKET_STATUS.OPEN })),
        supportTicket_model_1.SupportTicket.countDocuments(Object.assign(Object.assign({}, statsFilter), { status: supportTicket_constant_1.SUPPORT_TICKET_STATUS.IN_PROGRESS })),
        supportTicket_model_1.SupportTicket.countDocuments(Object.assign(Object.assign({}, statsFilter), { status: {
                $in: [supportTicket_constant_1.SUPPORT_TICKET_STATUS.RESOLVED, supportTicket_constant_1.SUPPORT_TICKET_STATUS.CLOSED],
            } })),
    ]);
    return {
        totalTickets,
        openTickets,
        inProgressTickets,
        resolvedClosedTickets,
    };
});
// 4. Get Support Ticket Details by ID or Custom ticketId (TIK-1001)
const getSupportTicketByIdFromDB = (idOrCustomId, user) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const ticket = yield findTicketByIdOrCustomId(idOrCustomId)
        .populate({
        path: "requester",
        select: "_id firstName lastName name email phone role profileImage professionalDetails",
    })
        .populate({
        path: "assignedAdmin",
        select: "_id firstName lastName name email role profileImage",
    })
        .populate({
        path: "discussion.sender",
        select: "_id firstName lastName name role profileImage",
    });
    if (!ticket) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Support ticket not found");
    }
    const isAdminUser = user.role === user_1.USER_ROLES.ADMIN || user.role === user_1.USER_ROLES.SUPER_ADMIN;
    // Non-admins can only see their own tickets
    if (!isAdminUser) {
        const requesterId = ((_a = ticket.requester) === null || _a === void 0 ? void 0 : _a._id)
            ? ticket.requester._id.toString()
            : ticket.requester.toString();
        if (requesterId !== user.id) {
            throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "You do not have permission to view this support ticket");
        }
    }
    return ticket;
});
// 5. Update Support Ticket (Admin only: status, priority, assignedAdmin, mark as resolved)
const updateSupportTicketInDB = (idOrCustomId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const ticket = yield findTicketByIdOrCustomId(idOrCustomId);
    if (!ticket) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Support ticket not found");
    }
    if (payload.status !== undefined) {
        ticket.status = payload.status;
    }
    if (payload.priority !== undefined) {
        ticket.priority = payload.priority;
    }
    if (payload.assignedAdmin !== undefined) {
        if (payload.assignedAdmin) {
            const adminUser = yield user_model_1.User.isExistUserById(payload.assignedAdmin.toString());
            if (!adminUser) {
                throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Assigned admin not found");
            }
            ticket.assignedAdmin = new mongoose_1.Types.ObjectId(payload.assignedAdmin);
        }
        else {
            ticket.assignedAdmin = null;
        }
    }
    yield ticket.save();
    realtime_socket_1.realtimeSocket.ticket({
        ticketId: ticket._id,
        requesterId: ticket.requester,
        action: "status",
        status: ticket.status,
    });
    return getSupportTicketByIdFromDB(ticket._id.toString(), {
        id: "",
        role: user_1.USER_ROLES.ADMIN,
    });
});
// 6. Add Reply to Ticket Discussion (Admin or Ticket Requester)
const addReplyToTicketInDB = (idOrCustomId, message, user) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const ticket = yield findTicketByIdOrCustomId(idOrCustomId);
    if (!ticket) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Support ticket not found");
    }
    const isAdminUser = user.role === user_1.USER_ROLES.ADMIN || user.role === user_1.USER_ROLES.SUPER_ADMIN;
    const requesterId = ((_a = ticket.requester) === null || _a === void 0 ? void 0 : _a._id)
        ? ticket.requester._id.toString()
        : ticket.requester.toString();
    // If not admin, verify ownership
    if (!isAdminUser && requesterId !== user.id) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "You do not have permission to reply to this ticket");
    }
    const senderUser = yield user_model_1.User.isExistUserById(user.id);
    const senderName = (senderUser === null || senderUser === void 0 ? void 0 : senderUser.name) || "User";
    ticket.discussion.push({
        sender: new mongoose_1.Types.ObjectId(user.id),
        senderName,
        senderRole: user.role,
        message,
        createdAt: new Date(),
    });
    // If ticket was open and an admin replies, transition status to in_progress
    if (isAdminUser && ticket.status === supportTicket_constant_1.SUPPORT_TICKET_STATUS.OPEN) {
        ticket.status = supportTicket_constant_1.SUPPORT_TICKET_STATUS.IN_PROGRESS;
    }
    yield ticket.save();
    realtime_socket_1.realtimeSocket.ticket({
        ticketId: ticket._id,
        requesterId: ticket.requester,
        action: "reply",
        status: ticket.status,
    });
    return getSupportTicketByIdFromDB(ticket._id.toString(), user);
});
// 7. Delete Ticket Permanently (Close ticket permanently - Admin only)
const deleteSupportTicketFromDB = (idOrCustomId) => __awaiter(void 0, void 0, void 0, function* () {
    const ticket = yield findTicketByIdOrCustomId(idOrCustomId);
    if (!ticket) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Support ticket not found");
    }
    realtime_socket_1.realtimeSocket.ticket({
        ticketId: ticket._id,
        requesterId: ticket.requester,
        action: "deleted",
        status: ticket.status,
    });
    const deletedTicket = yield supportTicket_model_1.SupportTicket.softDeleteById(ticket._id.toString());
    if (!deletedTicket) {
        throw new ApiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Failed to delete support ticket");
    }
    return deletedTicket;
});
exports.SupportTicketServices = {
    createSupportTicketInDB,
    getAllSupportTicketsFromDB,
    getSupportTicketStatsFromDB,
    getSupportTicketByIdFromDB,
    updateSupportTicketInDB,
    addReplyToTicketInDB,
    deleteSupportTicketFromDB,
};
