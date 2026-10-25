import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { createAdapter } from '@socket.io/redis-adapter';
import { Emitter } from '@socket.io/redis-emitter';
import User from '../models/User.js';
import Project from '../models/Project.js';
import connectDB from '../config/db.js';
import { redisClient, redisPair } from './redis.js';

let io = null; // set only in processes that accept socket connections
let emitter = null; // used by REST-only processes (Vercel REST function) to reach sockets through Redis

// Where should events go? Local io if this process hosts sockets, otherwise the Redis emitter.
function bus() {
  if (io) return io;
  if (emitter === null) {
    const client = redisClient();
    emitter = client ? new Emitter(client) : false;
  }
  return emitter || null;
}

export const emitToProject = (projectId, event, payload) => bus()?.to(`project:${projectId}`).emit(event, payload);
export const emitToUser = (userId, event, payload) => bus()?.to(`user:${userId}`).emit(event, payload);

// A removed member's sockets must leave the project room
export const kickFromProject = (projectId, userId) =>
  bus()?.in(`user:${userId}`).socketsLeave(`project:${projectId}`);

/* ----------------------------- presence helpers -----------------------------
 * No in-memory maps: presence is derived from the sockets themselves (fetchSockets),
 * which works across many server instances when the Redis adapter is attached.     */

async function boardViewers(projectId, exceptSocketId) {
  const sockets = await io.in(`project:${projectId}`).fetchSockets();
  const ids = new Set();
  for (const s of sockets) {
    if (s.id !== exceptSocketId && s.data.boards?.includes(projectId)) ids.add(s.data.user._id);
  }
  return [...ids];
}

async function broadcastPresence(projectId, exceptSocketId) {
  io.to(`project:${projectId}`).emit('presence:update', { projectId, users: await boardViewers(projectId, exceptSocketId) });
}

async function onlineUserIds() {
  const all = await io.fetchSockets();
  return [...new Set(all.map((s) => s.data.user?._id).filter(Boolean))];
}

// Vercel may forward the function prefix (/api/socket-io) to the server. Strip it so the
// default Socket.IO path (/socket.io) matches either way.
export function stripVercelPrefix(server) {
  const normalise = (req) => {
    const m = req.url.match(/^\/api\/socket-io(?:\/socket\.io)?\/?(\?.*)?$/);
    if (m) req.url = `/socket.io/${m[1] || ''}`;
  };
  server.prependListener('request', normalise);
  server.prependListener('upgrade', normalise);
}

export async function attachRedisAdapter(ioInstance) {
  const pair = await redisPair();
  if (!pair) return false;
  ioInstance.adapter(createAdapter(pair.pub, pair.sub));
  return true;
}

export function initSocket(httpServer, allowedOrigins, path = '/socket.io') {
  io = new Server(httpServer, { path, cors: { origin: allowedOrigins, credentials: true }, transports: ['websocket'] });

  // Authenticate every socket with the same JWT used by the REST API.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('unauthorized'));
      const { id } = jwt.verify(token, process.env.JWT_SECRET);
      await connectDB();
      const user = await User.findById(id).select('name');
      if (!user) return next(new Error('unauthorized'));
      socket.data.user = { _id: String(user._id), name: user.name };
      socket.data.boards = []; // boards this socket is "viewing" (for presence)
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    const { _id: userId, name } = socket.data.user;
    const userRoom = `user:${userId}`;

    // personal room -> used for notifications and invites
    await socket.join(userRoom);
    if ((await io.in(userRoom).fetchSockets()).length === 1) io.emit('presence:user', { userId, online: true });

    // who is online right now (answered with an ack; works across instances)
    socket.on('presence:online', async (ack) => ack?.(await onlineUserIds()));

    // Join a project room. `presence: true` means "I'm looking at the board".
    socket.on('project:join', async ({ projectId, presence = false } = {}, ack) => {
      try {
        const ok = await Project.exists({ _id: projectId, 'members.user': userId });
        if (!ok) return ack?.({ ok: false });
        projectId = String(projectId);
        if (presence && !socket.data.boards.includes(projectId)) socket.data.boards.push(projectId);
        await socket.join(`project:${projectId}`);
        if (presence) await broadcastPresence(projectId);
        ack?.({ ok: true, users: await boardViewers(projectId) });
      } catch {
        ack?.({ ok: false });
      }
    });

    socket.on('project:leave', async ({ projectId } = {}) => {
      projectId = String(projectId);
      const wasViewing = socket.data.boards.includes(projectId);
      socket.data.boards = socket.data.boards.filter((p) => p !== projectId);
      await socket.leave(`project:${projectId}`);
      if (wasViewing) await broadcastPresence(projectId);
    });

    // "Sara is typing..." indicator for task comments
    socket.on('typing', ({ projectId, taskId, isTyping } = {}) => {
      if (!socket.rooms.has(`project:${projectId}`)) return;
      socket.to(`project:${projectId}`).emit('typing', { taskId, isTyping: !!isTyping, user: { _id: userId, name } });
    });

    // 'disconnecting' fires while the socket is still in its rooms
    socket.on('disconnecting', async () => {
      try {
        for (const projectId of socket.data.boards) await broadcastPresence(projectId, socket.id);
        const others = (await io.in(userRoom).fetchSockets()).filter((s) => s.id !== socket.id);
        if (others.length === 0) io.emit('presence:user', { userId, online: false });
      } catch (err) {
        console.error('presence cleanup failed:', err.message);
      }
    });
  });

  return io;
}
