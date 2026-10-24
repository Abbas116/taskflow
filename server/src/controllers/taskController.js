import mongoose from 'mongoose';
import Task from '../models/Task.js';
import Comment from '../models/Comment.js';
import Activity from '../models/Activity.js';
import Notification from '../models/Notification.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { getProjectForMember, getTaskForMember, memberIdSet } from '../services/access.js';
import { notify } from '../services/notify.js';
import { logActivity } from '../services/activity.js';
import { emitToProject } from '../socket/index.js';

const populateTask = (q) =>
  q.populate('assignees', 'name email avatar').populate('createdBy', 'name avatar');

const cleanLabels = (labels) =>
  [...new Set(labels.map((l) => String(l).trim()).filter(Boolean))].slice(0, 8);

/* ------------------------- list / create / read ------------------------- */

export const listProjectTasks = asyncHandler(async (req, res) => {
  const { project } = await getProjectForMember(req.params.projectId, req.user._id);
  const tasks = await populateTask(Task.find({ project: project._id }).sort('order'));
  res.json(tasks);
});

export const createTask = asyncHandler(async (req, res) => {
  const { project } = await getProjectForMember(req.params.projectId, req.user._id);
  const { title, description = '', columnId, priority, dueDate, assignees = [], labels = [] } = req.body;
  if (!title?.trim()) throw new ApiError(400, 'Task title is required');

  const column = columnId ? project.columns.id(columnId) : project.columns[0];
  if (!column) throw new ApiError(400, 'Invalid column');

  const members = memberIdSet(project);
  const assigneeIds = [...new Set(assignees.map(String))].filter((id) => members.has(id));

  const task = await Task.create({
    project: project._id,
    title: title.trim(),
    description,
    column: column._id,
    order: await Task.countDocuments({ project: project._id, column: column._id }),
    ...(priority && { priority }),
    dueDate: dueDate ? new Date(dueDate) : null,
    assignees: assigneeIds,
    labels: cleanLabels(labels),
    createdBy: req.user._id,
    isDone: column.isDone,
    completedAt: column.isDone ? new Date() : null,
  });

  await logActivity({ project: project._id, task: task._id, actor: req.user, text: `created this task in ${column.name}` });
  await notify({
    users: assigneeIds,
    actor: req.user._id,
    type: 'task_assigned',
    message: `${req.user.name} assigned you "${task.title}"`,
    project: project._id,
    task: task._id,
  });

  const populated = await populateTask(Task.findById(task._id));
  emitToProject(project._id, 'task:created', populated);
  res.status(201).json(populated);
});

export const getTask = asyncHandler(async (req, res) => {
  const { task } = await getTaskForMember(req.params.id, req.user._id);
  res.json(await populateTask(Task.findById(task._id)));
});

/* ------------------------------- update ------------------------------- */

export const updateTask = asyncHandler(async (req, res) => {
  const { task, project } = await getTaskForMember(req.params.id, req.user._id);
  const b = req.body;
  const changes = [];

  if (b.title !== undefined) {
    if (!String(b.title).trim()) throw new ApiError(400, 'Task title is required');
    task.title = String(b.title).trim();
  }
  if (b.description !== undefined) task.description = b.description;

  if (b.priority !== undefined && b.priority !== task.priority) {
    changes.push(`changed the priority from ${task.priority} to ${b.priority}`);
    task.priority = b.priority; // enum is validated by Mongoose on save
  }

  if (b.dueDate !== undefined) {
    task.dueDate = b.dueDate ? new Date(b.dueDate) : null;
    task.dueNotified = false;
    changes.push(
      task.dueDate
        ? `set the due date to ${task.dueDate.toISOString().slice(0, 10)}`
        : 'removed the due date'
    );
  }

  if (Array.isArray(b.labels)) task.labels = cleanLabels(b.labels);

  if (Array.isArray(b.subtasks)) {
    task.subtasks = b.subtasks
      .filter((s) => String(s.title || '').trim())
      .map((s) => ({
        ...(mongoose.isValidObjectId(s._id) && { _id: s._id }),
        title: String(s.title).trim(),
        done: !!s.done,
      }));
  }

  let newlyAssigned = [];
  if (Array.isArray(b.assignees)) {
    const members = memberIdSet(project);
    const previous = task.assignees.map(String);
    const next = [...new Set(b.assignees.map(String))].filter((id) => members.has(id));
    newlyAssigned = next.filter((id) => !previous.includes(id));
    if (next.length !== previous.length || newlyAssigned.length) changes.push('updated the assignees');
    task.assignees = next;
  }

  await task.save();

  for (const text of changes) await logActivity({ project: project._id, task: task._id, actor: req.user, text });
  await notify({
    users: newlyAssigned,
    actor: req.user._id,
    type: 'task_assigned',
    message: `${req.user.name} assigned you "${task.title}"`,
    project: project._id,
    task: task._id,
  });

  const populated = await populateTask(Task.findById(task._id));
  emitToProject(project._id, 'task:updated', populated);
  res.json(populated);
});

/* ------------------------- drag & drop / reorder ------------------------- */

export const moveTask = asyncHandler(async (req, res) => {
  const { task, project } = await getTaskForMember(req.params.id, req.user._id);
  const { columnId, index } = req.body;

  const dest = project.columns.id(columnId);
  if (!dest) throw new ApiError(400, 'Invalid column');

  const fromColumnId = String(task.column);
  const changedColumn = fromColumnId !== String(dest._id);

  // Destination column order with the moved task inserted at `index`
  const destIds = (
    await Task.find({ project: project._id, column: dest._id, _id: { $ne: task._id } }).sort('order').select('_id')
  ).map((t) => String(t._id));
  const pos = Number.isInteger(index) ? Math.max(0, Math.min(index, destIds.length)) : destIds.length;
  destIds.splice(pos, 0, String(task._id));

  const columnOrders = { [String(dest._id)]: destIds };
  const ops = destIds.map((id, i) => ({
    updateOne: {
      filter: { _id: id },
      update: {
        $set:
          id === String(task._id)
            ? {
                column: dest._id,
                order: i,
                isDone: dest.isDone,
                completedAt: dest.isDone ? task.completedAt || new Date() : null,
              }
            : { order: i },
      },
    },
  }));

  if (changedColumn) {
    const srcIds = (
      await Task.find({ project: project._id, column: fromColumnId, _id: { $ne: task._id } }).sort('order').select('_id')
    ).map((t) => String(t._id));
    srcIds.forEach((id, i) => ops.push({ updateOne: { filter: { _id: id }, update: { $set: { order: i } } } }));
    columnOrders[fromColumnId] = srcIds;
  }

  await Task.bulkWrite(ops);

  if (changedColumn) {
    await logActivity({ project: project._id, task: task._id, actor: req.user, text: `moved this to ${dest.name}` });
    await notify({
      users: [...task.assignees, task.createdBy],
      actor: req.user._id,
      type: 'status_changed',
      message: `${req.user.name} moved "${task.title}" to ${dest.name}`,
      project: project._id,
      task: task._id,
    });
  }

  const populated = await populateTask(Task.findById(task._id));
  emitToProject(project._id, 'task:moved', { task: populated, columnOrders, actorId: String(req.user._id) });
  res.json({ task: populated, columnOrders });
});

/* -------------------------------- delete -------------------------------- */

export const deleteTask = asyncHandler(async (req, res) => {
  const { task, project } = await getTaskForMember(req.params.id, req.user._id);
  await Promise.all([
    Comment.deleteMany({ task: task._id }),
    Activity.deleteMany({ task: task._id }),
    Notification.deleteMany({ task: task._id }),
    task.deleteOne(),
  ]);
  emitToProject(project._id, 'task:deleted', { taskId: String(task._id), columnId: String(task.column) });
  res.json({ message: 'Task deleted' });
});

/* ----------------------------- my tasks / log ----------------------------- */

export const myTasks = asyncHandler(async (req, res) => {
  const tasks = await Task.find({ assignees: req.user._id })
    .populate('project', 'name color columns')
    .populate('assignees', 'name avatar')
    .lean();

  const result = tasks
    .filter((t) => t.project)
    .map((t) => {
      const column = t.project.columns.find((c) => String(c._id) === String(t.column));
      return {
        ...t,
        columnName: column?.name || '',
        project: {
          _id: t.project._id,
          name: t.project.name,
          color: t.project.color,
          columns: t.project.columns.map((c) => ({ _id: c._id, name: c.name, isDone: c.isDone })),
        },
      };
    })
    .sort((a, b) => {
      if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });

  res.json(result);
});

export const taskActivity = asyncHandler(async (req, res) => {
  const { task } = await getTaskForMember(req.params.id, req.user._id);
  const items = await Activity.find({ task: task._id }).sort('-createdAt').limit(50).populate('actor', 'name avatar');
  res.json(items);
});
