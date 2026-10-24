import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { emitToUser } from '../socket/index.js';

// Which user preference toggles each notification type
const PREF_KEY = {
  task_assigned: 'assigned',
  comment: 'comments',
  mention: 'mentions',
  due_soon: 'dueSoon',
  status_changed: 'statusChanged',
  project_invite: 'invites',
};

// Creates notifications (skipping the actor and users who disabled this type)
// and pushes each one in real time through the recipient's personal socket room.
export async function notify({ users, actor = null, type, message, project = null, task = null }) {
  const actorId = actor ? String(actor) : null;
  const ids = [...new Set(users.filter(Boolean).map(String))].filter((id) => id !== actorId);
  if (!ids.length) return;

  const recipients = await User.find({ _id: { $in: ids } }).select('notificationPrefs');
  const allowed = recipients.filter((u) => u.notificationPrefs?.[PREF_KEY[type]] !== false);
  if (!allowed.length) return;

  const docs = await Notification.insertMany(
    allowed.map((u) => ({ user: u._id, actor, type, message, project, task }))
  );
  await Notification.populate(docs, { path: 'actor', select: 'name avatar' });
  docs.forEach((d) => emitToUser(d.user, 'notification:new', d));
}
