import Task from '../models/Task.js';
import { notify } from '../services/notify.js';

// Every 30 minutes: notify assignees about tasks due within 24 hours (once per due date).
async function run() {
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
  }
}

export function startDueSoonJob() {
  const safeRun = () => run().catch((err) => console.error('dueSoon job failed:', err.message));
  safeRun();
  setInterval(safeRun, 30 * 60 * 1000);
}
