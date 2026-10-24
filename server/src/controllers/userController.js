import User from '../models/User.js';
import { asyncHandler } from '../utils/ApiError.js';
import { getOnlineUserIds } from '../socket/index.js';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Search people by name or email (used by "Invite members")
export const searchUsers = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json([]);
  const rx = new RegExp(escapeRegex(q), 'i');
  const users = await User.find({ _id: { $ne: req.user._id }, $or: [{ name: rx }, { email: rx }] })
    .select('name email avatar title')
    .limit(8);
  res.json(users);
});

export const onlineUsers = asyncHandler(async (_req, res) => res.json(getOnlineUserIds()));
