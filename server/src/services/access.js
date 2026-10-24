import mongoose from 'mongoose';
import Project from '../models/Project.js';
import Task from '../models/Task.js';
import { ApiError } from '../utils/ApiError.js';

export const userSelect = 'name email avatar title';

// Loads a project and makes sure the user is a member. Returns the project and the user's role.
export async function getProjectForMember(projectId, userId) {
  if (!mongoose.isValidObjectId(projectId)) throw new ApiError(404, 'Project not found');
  const project = await Project.findById(projectId);
  if (!project) throw new ApiError(404, 'Project not found');
  const member = project.members.find((m) => String(m.user) === String(userId));
  if (!member) throw new ApiError(403, 'You are not a member of this project');
  return { project, role: member.role };
}

export async function getTaskForMember(taskId, userId) {
  if (!mongoose.isValidObjectId(taskId)) throw new ApiError(404, 'Task not found');
  const task = await Task.findById(taskId);
  if (!task) throw new ApiError(404, 'Task not found');
  const { project, role } = await getProjectForMember(task.project, userId);
  return { task, project, role };
}

export const assertAdmin = (role) => {
  if (role !== 'admin') throw new ApiError(403, 'Only project admins can do this');
};

export const memberIdSet = (project) => new Set(project.members.map((m) => String(m.user)));
