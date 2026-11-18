import { USER_ROLES } from "../../../enums/user";
import { socketHelper } from "../../../helpers/socketHelper";

type LivePayload = {
  id: string;
  action: string;
  status?: string;
  jobRequestId?: string;
};

const ADMIN_ROLES = [USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN];

const idOf = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && "_id" in (value as object)) {
    return String((value as { _id?: unknown })._id || "");
  }
  const text = String(value);
  return text === "[object Object]" ? "" : text;
};

const emit = (
  event: string,
  userIds: unknown[],
  roles: string[],
  data: LivePayload,
) => {
  try {
    const sent = new Set<string>();
    for (const raw of userIds) {
      const userId = idOf(raw);
      if (!userId || sent.has(userId)) continue;
      sent.add(userId);
      socketHelper.sendToUser(userId, `${event}::${userId}`, data);
    }
    socketHelper.sendToRoles(roles, event, data, sent);
  } catch {
    // A socket failure must not change the API result.
  }
};

const rolesFor = (broadcastProfessionals?: boolean) =>
  broadcastProfessionals
    ? [...ADMIN_ROLES, USER_ROLES.PROFESSIONAL]
    : ADMIN_ROLES;

export const realtimeSocket = {
  ticket(input: {
    ticketId?: unknown;
    requesterId?: unknown;
    action: string;
    status?: string;
  }) {
    emit(
      "ticketUpdated",
      [input.requesterId],
      ADMIN_ROLES,
      {
        id: idOf(input.ticketId),
        action: input.action,
        status: input.status,
      },
    );
  },

  booking(input: {
    bookingId?: unknown;
    jobRequestId?: unknown;
    homeownerId?: unknown;
    professionalId?: unknown;
    action: string;
    status?: string;
    broadcastProfessionals?: boolean;
  }) {
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

  job(input: {
    jobRequestId?: unknown;
    homeownerId?: unknown;
    professionalId?: unknown;
    action: string;
    status?: string;
    broadcastProfessionals?: boolean;
  }) {
    emit(
      "jobUpdated",
      [input.homeownerId, input.professionalId],
      rolesFor(input.broadcastProfessionals),
      {
        id: idOf(input.jobRequestId),
        action: input.action,
        status: input.status,
      },
    );
  },

  quote(input: {
    quotationId?: unknown;
    jobRequestId?: unknown;
    homeownerId?: unknown;
    professionalId?: unknown;
    action: string;
    status?: string;
    broadcastProfessionals?: boolean;
  }) {
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
