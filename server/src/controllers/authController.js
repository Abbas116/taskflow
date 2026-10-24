import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const sign = (id, remember) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: remember ? '30d' : '1d' });

export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name?.trim() || !EMAIL_RE.test(email || '') || !password || password.length < 6) {
    throw new ApiError(400, 'Name, a valid email and a password (min 6 characters) are required');
  }
  if (await User.findOne({ email: email.toLowerCase() })) {
    throw new ApiError(409, 'This email is already registered');
  }
  const user = await User.create({ name: name.trim(), email, password });
  res.status(201).json({ user, token: sign(user._id, true) });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password, remember } = req.body;
  if (!email || !password) throw new ApiError(400, 'Email and password are required');
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user || !(await user.matchPassword(password))) throw new ApiError(401, 'Invalid email or password');
  res.json({ user, token: sign(user._id, !!remember) });
});

export const me = asyncHandler(async (req, res) => res.json({ user: req.user }));

export const updateMe = asyncHandler(async (req, res) => {
  const { name, title, avatar, notificationPrefs } = req.body;
  if (name !== undefined) {
    if (!name.trim()) throw new ApiError(400, 'Name cannot be empty');
    req.user.name = name.trim();
  }
  if (title !== undefined) req.user.title = title;
  if (avatar !== undefined) {
    if (avatar.length > 300000) throw new ApiError(400, 'Avatar image is too large');
    req.user.avatar = avatar;
  }
  if (notificationPrefs) {
    for (const key of Object.keys(req.user.notificationPrefs.toObject())) {
      if (typeof notificationPrefs[key] === 'boolean') req.user.notificationPrefs[key] = notificationPrefs[key];
    }
  }
  await req.user.save();
  res.json({ user: req.user });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) throw new ApiError(400, 'New password must be at least 6 characters');
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.matchPassword(currentPassword || ''))) throw new ApiError(400, 'Current password is incorrect');
  user.password = newPassword; // hashed by the pre-save hook
  await user.save();
  res.json({ message: 'Password updated' });
});
