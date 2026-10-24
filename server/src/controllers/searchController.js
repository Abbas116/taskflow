import Project from '../models/Project.js';
import Task from '../models/Task.js';
import { asyncHandler } from '../utils/ApiError.js';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Global search box: projects + tasks inside projects the user belongs to
export const search = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ projects: [], tasks: [] });
  const rx = new RegExp(escapeRegex(q), 'i');

  const mine = await Project.find({ 'members.user': req.user._id }).select('name color icon');
  const ids = mine.map((p) => p._id);
  const tasks = await Task.find({ project: { $in: ids }, title: rx })
    .select('title project priority isDone')
    .sort('-updatedAt')
    .limit(6)
    .lean();

  const byId = Object.fromEntries(mine.map((p) => [String(p._id), p]));
  res.json({
    projects: mine.filter((p) => rx.test(p.name)).slice(0, 4),
    tasks: tasks.map((t) => ({ ...t, projectName: byId[t.project]?.name, projectColor: byId[t.project]?.color })),
  });
});
