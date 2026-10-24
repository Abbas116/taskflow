import mongoose from 'mongoose';
import Project from '../models/Project.js';
import Task from '../models/Task.js';
import Comment from '../models/Comment.js';
import Activity from '../models/Activity.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { getProjectForMember, assertAdmin, userSelect } from '../services/access.js';
import { notify } from '../services/notify.js';
import { projectTaskStats } from '../services/stats.js';
import { emitToProject, emitToUser, kickFromProject } from '../socket/index.js';

const populateProject = (q) => q.populate('members.user', userSelect);

export const listProjects = asyncHandler(async (req, res) => {
  const projects = await populateProject(
    Project.find({ 'members.user': req.user._id }).sort('-updatedAt')
  ).lean();

  const byProject = await projectTaskStats(projects.map((p) => p._id));

  res.json(
    projects.map((p) => ({
      ...p,
      taskCount: byProject[p._id]?.total || 0,
      doneCount: byProject[p._id]?.done || 0,
    }))
  );
});

export const createProject = asyncHandler(async (req, res) => {
  const { name, description = '', color, icon, memberIds = [] } = req.body;
  if (!name?.trim()) throw new ApiError(400, 'Project name is required');

  const invited = await User.find({
    _id: { $in: memberIds.filter((id) => mongoose.isValidObjectId(id)) },
  }).select('_id');
  const others = invited.filter((u) => String(u._id) !== String(req.user._id));

  const project = await Project.create({
    name: name.trim(),
    description,
    ...(color && { color }),
    ...(icon && { icon }),
    owner: req.user._id,
    members: [
      { user: req.user._id, role: 'admin' },
      ...others.map((u) => ({ user: u._id, role: 'member' })),
    ],
  });

  await notify({
    users: others.map((u) => u._id),
    actor: req.user._id,
    type: 'project_invite',
    message: `${req.user.name} added you to the project "${project.name}"`,
    project: project._id,
  });

  const populated = await populateProject(Project.findById(project._id));
  others.forEach((u) => emitToUser(u._id, 'project:added', populated));
  res.status(201).json(populated);
});

export const getProject = asyncHandler(async (req, res) => {
  const { project, role } = await getProjectForMember(req.params.projectId, req.user._id);
  const populated = await populateProject(Project.findById(project._id)).lean();
  res.json({ ...populated, myRole: role });
});

export const updateProject = asyncHandler(async (req, res) => {
  const { project, role } = await getProjectForMember(req.params.projectId, req.user._id);
  assertAdmin(role);
  const { name, description, color, icon } = req.body;
  if (name !== undefined) {
    if (!name.trim()) throw new ApiError(400, 'Project name is required');
    project.name = name.trim();
  }
  if (description !== undefined) project.description = description;
  if (color) project.color = color;
  if (icon) project.icon = icon;
  await project.save();
  emitToProject(project._id, 'project:updated', { projectId: String(project._id) });
  res.json(await populateProject(Project.findById(project._id)));
});

export const deleteProject = asyncHandler(async (req, res) => {
  const { project } = await getProjectForMember(req.params.projectId, req.user._id);
  if (String(project.owner) !== String(req.user._id)) throw new ApiError(403, 'Only the project owner can delete it');

  const memberIds = project.members.map((m) => m.user);
  await Promise.all([
    Task.deleteMany({ project: project._id }),
    Comment.deleteMany({ project: project._id }),
    Activity.deleteMany({ project: project._id }),
    Notification.deleteMany({ project: project._id }),
    project.deleteOne(),
  ]);
  memberIds.forEach((id) => emitToUser(id, 'project:removed', { projectId: String(project._id) }));
  res.json({ message: 'Project deleted' });
});

/* ------------------------------ members ------------------------------ */

export const addMember = asyncHandler(async (req, res) => {
  const { project, role } = await getProjectForMember(req.params.projectId, req.user._id);
  assertAdmin(role);
  const { userId, email } = req.body;

  let user = null;
  if (userId && mongoose.isValidObjectId(userId)) user = await User.findById(userId);
  else if (email) user = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (!user) throw new ApiError(404, 'No user found with that email. Ask them to sign up first.');
  if (project.members.some((m) => String(m.user) === String(user._id))) {
    throw new ApiError(409, 'User is already a member');
  }

  project.members.push({ user: user._id, role: 'member' });
  await project.save();

  await notify({
    users: [user._id],
    actor: req.user._id,
    type: 'project_invite',
    message: `${req.user.name} added you to the project "${project.name}"`,
    project: project._id,
  });

  const populated = await populateProject(Project.findById(project._id));
  emitToUser(user._id, 'project:added', populated);
  emitToProject(project._id, 'project:updated', { projectId: String(project._id) });
  res.status(201).json(populated);
});

export const updateMemberRole = asyncHandler(async (req, res) => {
  const { project, role } = await getProjectForMember(req.params.projectId, req.user._id);
  assertAdmin(role);
  const { userId } = req.params;
  const newRole = req.body.role;
  if (!['admin', 'member'].includes(newRole)) throw new ApiError(400, 'Invalid role');
  if (String(project.owner) === userId) throw new ApiError(400, "The owner's role cannot be changed");

  const member = project.members.find((m) => String(m.user) === userId);
  if (!member) throw new ApiError(404, 'Member not found');
  member.role = newRole;
  await project.save();
  emitToProject(project._id, 'project:updated', { projectId: String(project._id) });
  res.json(await populateProject(Project.findById(project._id)));
});

export const removeMember = asyncHandler(async (req, res) => {
  const { project, role } = await getProjectForMember(req.params.projectId, req.user._id);
  const { userId } = req.params;
  const isSelf = String(req.user._id) === userId;
  if (!isSelf) assertAdmin(role); // members may leave on their own; only admins remove others
  if (String(project.owner) === userId) throw new ApiError(400, 'The owner cannot be removed from the project');

  const before = project.members.length;
  project.members = project.members.filter((m) => String(m.user) !== userId);
  if (project.members.length === before) throw new ApiError(404, 'Member not found');
  await project.save();

  // un-assign the removed user from this project's tasks
  await Task.updateMany({ project: project._id }, { $pull: { assignees: userId } });
  kickFromProject(project._id, userId);
  emitToUser(userId, 'project:removed', { projectId: String(project._id) });
  emitToProject(project._id, 'project:updated', { projectId: String(project._id) });
  res.json({ message: 'Member removed' });
});

/* ------------------------------ columns ------------------------------ */

export const addColumn = asyncHandler(async (req, res) => {
  const { project, role } = await getProjectForMember(req.params.projectId, req.user._id);
  assertAdmin(role);
  if (!req.body.name?.trim()) throw new ApiError(400, 'Column name is required');
  project.columns.push({ name: req.body.name.trim(), color: req.body.color || '#6366F1' });
  await project.save();
  emitToProject(project._id, 'project:updated', { projectId: String(project._id) });
  res.status(201).json(project.columns);
});

export const updateColumn = asyncHandler(async (req, res) => {
  const { project, role } = await getProjectForMember(req.params.projectId, req.user._id);
  assertAdmin(role);
  const column = project.columns.id(req.params.columnId);
  if (!column) throw new ApiError(404, 'Column not found');
  if (req.body.name !== undefined) {
    if (!req.body.name.trim()) throw new ApiError(400, 'Column name is required');
    column.name = req.body.name.trim();
  }
  if (req.body.color) column.color = req.body.color;
  await project.save();
  emitToProject(project._id, 'project:updated', { projectId: String(project._id) });
  res.json(project.columns);
});

export const deleteColumn = asyncHandler(async (req, res) => {
  const { project, role } = await getProjectForMember(req.params.projectId, req.user._id);
  assertAdmin(role);
  const column = project.columns.id(req.params.columnId);
  if (!column) throw new ApiError(404, 'Column not found');
  if (project.columns.length <= 1) throw new ApiError(400, 'A project needs at least one column');

  // Move the column's tasks to the first remaining column (appended at the end)
  const target = project.columns.find((c) => String(c._id) !== String(column._id));
  const base = await Task.countDocuments({ project: project._id, column: target._id });
  const moving = await Task.find({ project: project._id, column: column._id }).sort('order');
  await Promise.all(
    moving.map((t, i) =>
      Task.updateOne(
        { _id: t._id },
        { column: target._id, order: base + i, isDone: target.isDone, completedAt: target.isDone ? t.completedAt || new Date() : null }
      )
    )
  );

  column.deleteOne();
  await project.save();
  emitToProject(project._id, 'project:updated', { projectId: String(project._id) });
  res.json(project.columns);
});
