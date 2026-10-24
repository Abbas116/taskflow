import Task from '../models/Task.js';
import { notify } from '../services/notify.js';

// Long-running servers only (local / Render): every 30 minutes. On Vercel, /api/cron/due-soon is used instead.
// Every 30 minutes: notify assignees about tasks due within 24 hours (once per due date).
export async function runDueSoon() {
  let count = 0;
  const horizon = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const tasks = await Task.find({
    isDone: false,
    dueNotified: false,
    dueDate: { $ne: null, $lte: horizon },
    'assignees.0': { $exists: true },
  });

  for (const task of tasks) {
    const overdue = task.dueDate < new Date();
    await notify({
      users: task.assignees,
      type: 'due_soon',
      message: overdue ? `"${task.title}" is overdue` : `"${task.title}" is due soon`,
      project: task.project,
      task: task._id,
    });
    task.dueNotified = true;
    await task.save();
    count += 1;
  }
  return count;
}

export function startDueSoonJob() {
  const safeRun = () => runDueSoon().catch((err) => console.error('dueSoon job failed:', err.message));
  safeRun();
  setInterval(safeRun, 30 * 60 * 1000);
}
