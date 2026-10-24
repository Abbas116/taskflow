import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Project from '../models/Project.js';

let io = null;

// userId -> Set(socketId): who is online anywhere in the app
const userSockets = new Map();
// projectId -> Map(userId -> Set(socketId)): who is viewing a board right now
const boardPresence = new Map();

export const getOnlineUserIds = () => [...userSockets.keys()];
export const emitToProject = (projectId, event, payload) =>
  io?.to(`project:${projectId}`).emit(event, payload);
export const emitToUser = (userId, event, payload) =>
  io?.to(`user:${userId}`).emit(event, payload);

function presenceList(projectId) {
  return [...(boardPresence.get(String(projectId))?.keys() || [])];
}

function addPresence(projectId, userId, socketId) {
  if (!boardPresence.has(projectId)) boardPresence.set(projectId, new Map());
  const users = boardPresence.get(projectId);
  if (!users.has(userId)) users.set(userId, new Set());
  users.get(userId).add(socketId);
}

function removePresence(projectId, userId, socketId) {
  const users = boardPresence.get(projectId);
  if (!users) return;
  const sockets = users.get(userId);
  sockets?.delete(socketId);
  if (sockets && sockets.size === 0) users.delete(userId);
  if (users.size === 0) boardPresence.delete(projectId);
  io.to(`project:${projectId}`).emit('presence:update', { projectId, users: presenceList(projectId) });
}

// Called when a member is removed from a project: kick their sockets out of the room.
export function kickFromProject(projectId, userId) {
  if (!io) return;
  io.in(`user:${userId}`).socketsLeave(`project:${projectId}`);
  const users = boardPresence.get(String(projectId));
  if (users?.delete(String(userId))) {
    io.to(`project:${projectId}`).emit('presence:update', {
      projectId: String(projectId),
      users: presenceList(projectId),
    });
  }
}

export function initSocket(httpServer, allowedOrigins) {
  io = new Server(httpServer, { cors: { origin: allowedOrigins, credentials: true } });

  // Authenticate every socket with the same JWT used by the REST API.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('unauthorized'));
      const { id } = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(id).select('name');
      if (!user) return next(new Error('unauthorized'));
      socket.data.user = { _id: String(user._id), name: user.name };
      socket.data.boards = new Set();
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const { _id: userId, name } = socket.data.user;

    // personal room -> used for notifications and invites
    socket.join(`user:${userId}`);

    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId).add(socket.id);
    if (userSockets.get(userId).size === 1) io.emit('presence:user', { userId, online: true });

    // Join a project room. `presence: true` means "I'm looking at the board".
    socket.on('project:join', async ({ projectId, presence = false } = {}, ack) => {
      try {
        const ok = await Project.exists({ _id: projectId, 'members.user': userId });
        if (!ok) return ack?.({ ok: false });
        socket.join(`project:${projectId}`);
        if (presence) {
          socket.data.boards.add(projectId);
          addPresence(projectId, userId, socket.id);
          io.to(`project:${projectId}`).emit('presence:update', {
            projectId,
            users: presenceList(projectId),
          });
        }
        ack?.({ ok: true, users: presenceList(projectId) });
      } catch {
        ack?.({ ok: false });
      }
    });

    socket.on('project:leave', ({ projectId } = {}) => {
      socket.leave(`project:${projectId}`);
      if (socket.data.boards.delete(projectId)) removePresence(projectId, userId, socket.id);
    });

    // "Sara is typing..." indicator for task comments
    socket.on('typing', ({ projectId, taskId, isTyping } = {}) => {
      if (!socket.rooms.has(`project:${projectId}`)) return;
      socket.to(`project:${projectId}`).emit('typing', { taskId, isTyping: !!isTyping, user: { _id: userId, name } });
    });

    socket.on('disconnect', () => {
      for (const projectId of socket.data.boards) removePresence(projectId, userId, socket.id);
      const set = userSockets.get(userId);
      set?.delete(socket.id);
      if (set && set.size === 0) {
        userSockets.delete(userId);
        io.emit('presence:user', { userId, online: false });
      }
    });
  });

  return io;
}
