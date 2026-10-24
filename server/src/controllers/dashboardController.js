import Project from '../models/Project.js';
import Task from '../models/Task.js';
import Activity from '../models/Activity.js';
import { asyncHandler } from '../utils/ApiError.js';
import { userSelect } from '../services/access.js';
import { projectTaskStats } from '../services/stats.js';

const DAY = 24 * 60 * 60 * 1000;

export const dashboard = asyncHandler(async (req, res) => {
  const me = req.user._id;
  const projects = await Project.find({ 'members.user': me })
    .populate('members.user', userSelect)
    .sort('-updatedAt')
    .lean();
  const projectIds = projects.map((p) => p._id);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay.getTime() + DAY);
  const weekAgo = new Date(Date.now() - 7 * DAY);
  const inThreeDays = new Date(startOfDay.getTime() + 3 * DAY);
  const inSevenDays = new Date(startOfDay.getTime() + 7 * DAY);

  const taskPop = (q) => q.populate('project', 'name color').populate('assignees', 'name avatar');
  const openMine = { assignees: me, isDone: false };

  const [assignedToMe, dueToday, overdue, completedThisWeek, perProject, assigned, dueSoon, created, upcoming, activity] =
    await Promise.all([
      Task.countDocuments(openMine),
      Task.countDocuments({ ...openMine, dueDate: { $gte: startOfDay, $lt: endOfDay } }),
      Task.countDocuments({ ...openMine, dueDate: { $lt: startOfDay } }),
      Task.countDocuments({ project: { $in: projectIds }, isDone: true, completedAt: { $gte: weekAgo } }),
      projectTaskStats(projectIds),
      taskPop(Task.find(openMine).sort({ dueDate: 1 }).limit(8)).lean(),
      taskPop(Task.find({ ...openMine, dueDate: { $ne: null, $lt: inThreeDays } }).sort({ dueDate: 1 }).limit(8)).lean(),
      taskPop(Task.find({ createdBy: me, isDone: false }).sort('-createdAt').limit(8)).lean(),
      taskPop(Task.find({ ...openMine, dueDate: { $gte: startOfDay, $lt: inSevenDays } }).sort({ dueDate: 1 }).limit(5)).lean(),
      Activity.find({ project: { $in: projectIds } })
        .sort('-createdAt')
        .limit(8)
        .populate('actor', 'name avatar')
        .populate('task', 'title')
        .populate('project', 'name')
        .lean(),
    ]);

  const stats = perProject;
  const recentProjects = projects.slice(0, 3).map((p) => ({
    ...p,
    taskCount: stats[p._id]?.total || 0,
    doneCount: stats[p._id]?.done || 0,
  }));

  // everyone who shares a project with me (for the "Online now" card)
  const teammates = new Map();
  projects.forEach((p) =>
    p.members.forEach((m) => {
      if (String(m.user._id) !== String(me)) teammates.set(String(m.user._id), m.user);
    })
  );

  // The dashboard's due-soon tab keeps overdue items first; the client groups by the tab names below.
  res.json({
    stats: { totalProjects: projects.length, assignedToMe, dueToday, overdue, completedThisWeek },
    tasks: { assigned, dueSoon, created },
    projectIds: projectIds.slice(0, 20).map(String), // dashboard joins these socket rooms for live updates
    recentProjects,
    activity,
    upcoming,
    teammates: [...teammates.values()],
  });
});
