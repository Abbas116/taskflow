import Notification from '../models/Notification.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';

export const listNotifications = asyncHandler(async (req, res) => {
  const [notifications, unreadCount] = await Promise.all([
    Notification.find({ user: req.user._id }).sort('-createdAt').limit(100).populate('actor', 'name avatar'),
    Notification.countDocuments({ user: req.user._id, read: false }),
  ]);
  res.json({ notifications, unreadCount });
});

export const markRead = asyncHandler(async (req, res) => {
  const n = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { read: true },
    { new: true }
  );
  if (!n) throw new ApiError(404, 'Notification not found');
  res.json(n);
});

export const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
  res.json({ message: 'All notifications marked as read' });
});

export const deleteNotification = asyncHandler(async (req, res) => {
  await Notification.deleteOne({ _id: req.params.id, user: req.user._id });
  res.json({ message: 'Deleted' });
});
