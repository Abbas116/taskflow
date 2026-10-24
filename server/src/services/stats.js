import Task from '../models/Task.js';

// Task totals per project: { [projectId]: { total, done } }
export async function projectTaskStats(projectIds) {
  const rows = await Task.aggregate([
    { $match: { project: { $in: projectIds } } },
    { $group: { _id: { project: '$project', isDone: '$isDone' }, n: { $sum: 1 } } },
  ]);
  const stats = {};
  for (const r of rows) {
    const key = String(r._id.project);
    stats[key] ||= { total: 0, done: 0 };
    stats[key].total += r.n;
    if (r._id.isDone) stats[key].done += r.n;
  }
  return stats;
}
