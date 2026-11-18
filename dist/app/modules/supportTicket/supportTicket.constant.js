"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUPPORT_TICKET_FILTERABLE_FIELDS = exports.SUPPORT_TICKET_SEARCHABLE_FIELDS = exports.SUPPORT_TICKET_STATUS = exports.SUPPORT_TICKET_PRIORITY = void 0;
const supportTicket_1 = require("../../../enums/supportTicket");
Object.defineProperty(exports, "SUPPORT_TICKET_PRIORITY", { enumerable: true, get: function () { return supportTicket_1.SUPPORT_TICKET_PRIORITY; } });
Object.defineProperty(exports, "SUPPORT_TICKET_STATUS", { enumerable: true, get: function () { return supportTicket_1.SUPPORT_TICKET_STATUS; } });
exports.SUPPORT_TICKET_SEARCHABLE_FIELDS = [
    "ticketId",
    "subject",
    "description",
    "requesterName",
    "requesterEmail",
    "relatedJobId",
];
exports.SUPPORT_TICKET_FILTERABLE_FIELDS = [
    "searchTerm",
    "status",
    "priority",
    "requesterRole",
    "requester",
    "assignedAdmin",
];
