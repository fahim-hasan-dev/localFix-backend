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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupportTicket = void 0;
const mongoose_1 = require("mongoose");
const user_1 = require("../../../enums/user");
const softDeletePlugin_1 = require("../../../DB/plugins/softDeletePlugin");
const supportTicket_constant_1 = require("./supportTicket.constant");
const discussionMessageSchema = new mongoose_1.Schema({
    sender: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    senderName: {
        type: String,
        required: true,
        trim: true,
    },
    senderRole: {
        type: String,
        required: true,
        trim: true,
    },
    message: {
        type: String,
        required: true,
        trim: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
}, { _id: true });
const supportTicketSchema = new mongoose_1.Schema({
    ticketId: {
        type: String,
        unique: true,
        trim: true,
        uppercase: true,
        index: true,
    },
    requester: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: [true, "Requester ID is required"],
        index: true,
    },
    requesterName: {
        type: String,
        required: [true, "Requester name is required"],
        trim: true,
    },
    requesterEmail: {
        type: String,
        required: [true, "Requester email is required"],
        trim: true,
        lowercase: true,
    },
    requesterRole: {
        type: String,
        enum: Object.values(user_1.USER_ROLES),
        required: [true, "Requester role is required"],
        index: true,
    },
    priority: {
        type: String,
        enum: Object.values(supportTicket_constant_1.SUPPORT_TICKET_PRIORITY),
        default: supportTicket_constant_1.SUPPORT_TICKET_PRIORITY.MEDIUM,
        index: true,
    },
    status: {
        type: String,
        enum: Object.values(supportTicket_constant_1.SUPPORT_TICKET_STATUS),
        default: supportTicket_constant_1.SUPPORT_TICKET_STATUS.OPEN,
        index: true,
    },
    subject: {
        type: String,
        required: [true, "Subject is required"],
        trim: true,
    },
    description: {
        type: String,
        required: [true, "Detailed description is required"],
        trim: true,
    },
    relatedJobId: {
        type: String,
        trim: true,
        default: "",
    },
    assignedAdmin: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        default: null,
        index: true,
    },
    discussion: {
        type: [discussionMessageSchema],
        default: [],
    },
}, {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
// Auto-generate ticketId (e.g. TIK-1001, TIK-1002...) if not provided
supportTicketSchema.pre("validate", function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!this.ticketId) {
            try {
                const lastTicket = yield this.constructor
                    .findOne({}, { ticketId: 1 })
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
                this.ticketId = `TIK-${nextNumber}`;
            }
            catch (error) {
                return next(error);
            }
        }
        next();
    });
});
supportTicketSchema.plugin(softDeletePlugin_1.softDeletePlugin);
supportTicketSchema.index({ requester: 1, createdAt: -1 });
supportTicketSchema.index({ status: 1, priority: 1, createdAt: -1 });
exports.SupportTicket = (0, mongoose_1.model)("SupportTicket", supportTicketSchema);
