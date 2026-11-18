import colors from "colors";
import { Server, Socket } from "socket.io";
import { logger } from "../shared/logger";
import { jwtHelper } from "./jwtHelper";
import config from "../config";
import { User } from "../app/modules/user/user.model";
import { Secret } from "jsonwebtoken";

// One user can have the website open in more than one tab.
const socketMap = new Map<string, Set<Socket>>();

const trackSocket = (userId: string, client: Socket) => {
  const key = userId.toString();
  const sockets = socketMap.get(key) ?? new Set<Socket>();
  sockets.add(client);
  socketMap.set(key, sockets);
  client.data = { ...client.data, userId: key };
};

const untrackSocket = (userId: string, client: Socket) => {
  const key = userId.toString();
  const sockets = socketMap.get(key);
  if (!sockets) return;
  sockets.delete(client);
  if (sockets.size === 0) socketMap.delete(key);
};

const socket = (io: Server) => {
  io.on("connection", async (socket: Socket) => {
    logger.info(colors.blue("A User connected to Socket.IO"));
    logger.info(`Handshake Query: ${JSON.stringify(socket.handshake.query)}`);
    logger.info(`Handshake Auth: ${JSON.stringify(socket.handshake.auth)}`);

    // Attempt authentication via token in query or auth object
    let queryToken: string | undefined = undefined;
    if (socket.handshake.query) {
      for (const key of Object.keys(socket.handshake.query)) {
        if (key.trim() === "token") {
          queryToken = socket.handshake.query[key] as string;
          break;
        }
      }
    }

    let authToken: string | undefined = undefined;
    if (socket.handshake.auth) {
      for (const key of Object.keys(socket.handshake.auth)) {
        if (key.trim() === "token") {
          authToken = socket.handshake.auth[key] as string;
          break;
        }
      }
    }

    let token = queryToken || authToken;

    if (token && token.startsWith("Bearer ")) {
      token = token.split(" ")[1];
    }

    logger.info(
      `Extracted Token: ${token ? token.substring(0, 15) + "..." : "undefined"}`,
    );

    if (token) {
      try {
        const decoded = jwtHelper.verifyToken(
          token,
          config.jwt.jwt_secret as Secret,
        );
        if (decoded && decoded.id) {
          const userId = decoded.id.toString();

          // Verify if the user exists in the database
          const userExists = await User.findById(userId);
          if (!userExists) {
            logger.error(
              colors.red(
                `Socket authentication failed: User ${userId} does not exist in the database.`,
              ),
            );
            socket.disconnect();
            return;
          }

          socket.data = { userId, role: decoded.role };
          trackSocket(userId, socket);
          logger.info(
            colors.green(
              `Socket successfully authenticated for User: ${userId} (${decoded.role})`,
            ),
          );
        }
      } catch (err: any) {
        logger.error(
          colors.yellow(
            `Socket connection token verification failed: ${err.message}`,
          ),
        );
      }
    }

    // Explicit registration event fallback
    socket.on("register", (data: { userId: string }) => {
      if (data?.userId) {
        const userId = data.userId.toString();
        trackSocket(userId, socket);
        logger.info(
          colors.green(`Socket manually registered User ID: ${userId}`),
        );
      }
    });

    // disconnect
    socket.on("disconnect", (reason) => {
      const userId = socket.data?.userId;
      if (userId) {
        untrackSocket(userId, socket);
        logger.info(
          colors.red(`User ${userId} disconnected. Reason: ${reason}`),
        );
      } else {
        logger.info(colors.red(`A user disconnect. Reason: ${reason}`));
      }
    });
  });
};

/**
 * Emit socket event to a specific user
 */
const sendToUser = (
  userId: string | any,
  event: string,
  data: any,
): boolean => {
  if (!userId) return false;
  const key = userId.toString();
  const clients = socketMap.get(key);
  if (clients && clients.size > 0) {
    clients.forEach((clientSocket) => {
      clientSocket.emit(event, data);
    });
    logger.info(colors.green(`Socket event '${event}' sent to user: ${key}`));
    return true;
  }
  logger.warn(
    colors.yellow(`Socket event '${event}' FAILED - user ${key} not connected`),
  );
  return false;
};

/**
 * Emit socket event to multiple users
 */
const sendToUsers = (
  userIds: (string | any)[],
  event: string,
  data: any,
): void => {
  for (const id of userIds) {
    sendToUser(id, event, data);
  }
};

// Reach every connected user with one of these roles, except ids already notified.
const sendToRoles = (
  roles: string[],
  event: string,
  data: any,
  skip: Set<string> = new Set(),
): void => {
  const wanted = new Set(roles);
  for (const [userId, clients] of socketMap) {
    if (skip.has(userId)) continue;
    const matches = [...clients].some((client) =>
      wanted.has(String(client.data?.role || "")),
    );
    if (!matches) continue;
    sendToUser(userId, `${event}::${userId}`, data);
  }
};

export const socketHelper = {
  socket,
  sendToUser,
  sendToUsers,
  sendToRoles,
};
