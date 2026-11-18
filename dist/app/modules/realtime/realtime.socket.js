"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.realtimeSocket = void 0;
const user_1 = require("../../../enums/user");
const socketHelper_1 = require("../../../helpers/socketHelper");
const ADMIN_ROLES = [user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN];
const idOf = (value) => {
    if (!value)
        return "";
    if (typeof value === "string")
        return value;
    if (typeof value === "object" && "_id" in value) {
        return String(value._id || "");
    }
    const text = String(value);
    return text === "[object Object]" ? "" : text;
};
const emit = (event, userIds, roles, data) => {
    try {
        const sent = new Set();
        for (const raw of userIds) {
            const userId = idOf(raw);
            if (!userId || sent.has(userId))
                continue;
            sent.add(userId);
            socketHelper_1.socketHelper.sendToUser(userId, `${event}::${userId}`, data);
        }
        socketHelper_1.socketHelper.sendToRoles(roles, event, data, sent);
    }
    catch (_a) {
        // A socket failure must not change the API result.
    }
};
const rolesFor = (broadcastProfessionals) => broadcastProfessionals
    ? [...ADMIN_ROLES, user_1.USER_ROLES.PROFESSIONAL]
    : ADMIN_ROLES;
exports.realtimeSocket = {
    ticket(input) {
        emit("ticketUpdated", [input.requesterId], ADMIN_ROLES, {
            id: idOf(input.ticketId),
            action: input.action,
            status: input.status,
        });
    },
    booking(input) {
        const jobRequestId = idOf(input.jobRequestId);
        const parties = [input.homeownerId, input.professionalId];
        const roles = rolesFor(input.broadcastProfessionals);
        emit("bookingUpdated", parties, roles, {
            id: idOf(input.bookingId),
            jobRequestId,
            action: input.action,
            status: input.status,
        });
        if (jobRequestId) {
            emit("jobUpdated", parties, roles, {
                id: jobRequestId,
                action: input.action,
                status: input.status,
            });
        }
    },
    job(input) {
        emit("jobUpdated", [input.homeownerId, input.professionalId], rolesFor(input.broadcastProfessionals), {
            id: idOf(input.jobRequestId),
            action: input.action,
            status: input.status,
        });
    },
    quote(input) {
        const parties = [input.homeownerId, input.professionalId];
        const roles = rolesFor(input.broadcastProfessionals);
        emit("quoteUpdated", parties, roles, {
            id: idOf(input.quotationId),
            jobRequestId: idOf(input.jobRequestId),
            action: input.action,
            status: input.status,
        });
        emit("jobUpdated", parties, roles, {
            id: idOf(input.jobRequestId),
            action: input.action,
            status: input.status,
        });
    },
};
