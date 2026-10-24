import Comment from '../models/Comment.js';
import Task from '../models/Task.js';
import Project from '../models/Project.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { getTaskForMember, memberIdSet } from '../services/access.js';
import { notify } from '../services/notify.js';
import { emitToProject } from '../socket/index.js';

export const listComments = asyncHandler(async (req, res) => {
  const { task } = await getTaskForMember(req.params.id, req.user._id);
  res.json(await Comment.find({ task: task._id }).sort('createdAt').populate('author', 'name avatar'));
});

export const createComment = asyncHandler(async (req, res) => {
  const { task, project } = await getTaskForMember(req.params.id, req.user._id);
  const { text, mentions = [], parent = null } = req.body;
  if (!text?.trim()) throw new ApiError(400, 'Comment cannot be empty');

  const members = memberIdSet(project);
  const mentionIds = [...new Set(mentions.map(String))].filter(
    (id) => members.has(id) && id !== String(req.user._id)
  );

  // Replies are flattened to a single level: replying to a reply attaches to the root comment
  let parentId = null;
  if (parent) {
    const p = await Comment.findOne({ _id: parent, task: task._id });
    if (!p) throw new ApiError(400, 'Parent comment not found');
    parentId = p.parent || p._id;
  }

  const comment = await Comment.create({
    task: task._id,
    project: project._id,
    author: req.user._id,
    text: text.trim(),
    mentions: mentionIds,
    parent: parentId,
  });
  await Task.updateOne({ _id: task._id }, { $inc: { commentsCount: 1 } });
  await comment.populate('author', 'name avatar');

  // mentioned people get a "mention" notification; assignees/creator get a "comment" one
  await notify({
    users: mentionIds,
    actor: req.user._id,
    type: 'mention',
    message: `${req.user.name} mentioned you in "${task.title}"`,
    project: project._id,
    task: task._id,
  });
  await notify({
    users: [...task.assignees, task.createdBy].filter((id) => !mentionIds.includes(String(id))),
    actor: req.user._id,
    type: 'comment',
    message: `${req.user.name} commented on "${task.title}"`,
    project: project._id,
    task: task._id,
  });

  emitToProject(project._id, 'comment:created', { taskId: String(task._id), comment });
  res.status(201).json(comment);
});

export const updateComment = asyncHandler(async (req, res) => {
  const comment = await Comment.findById(req.params.id);
  if (!comment) throw new ApiError(404, 'Comment not found');
  if (String(comment.author) !== String(req.user._id)) throw new ApiError(403, 'You can only edit your own comments');
  if (!req.body.text?.trim()) throw new ApiError(400, 'Comment cannot be empty');

  comment.text = req.body.text.trim();
  comment.edited = true;
  await comment.save();
  await comment.populate('author', 'name avatar');
  emitToProject(comment.project, 'comment:updated', { taskId: String(comment.task), comment });
  res.json(comment);
});

export const deleteComment = asyncHandler(async (req, res) => {
  const comment = await Comment.findById(req.params.id);
  if (!comment) throw new ApiError(404, 'Comment not found');

  const project = await Project.findById(comment.project);
  const member = project?.members.find((m) => String(m.user) === String(req.user._id));
  const isAuthor = String(comment.author) === String(req.user._id);
  if (!member || (!isAuthor && member.role !== 'admin')) throw new ApiError(403, 'Not allowed to delete this comment');

  const replies = await Comment.find({ parent: comment._id }).select('_id');
  const removedIds = [comment._id, ...replies.map((r) => r._id)].map(String);
  await Comment.deleteMany({ _id: { $in: removedIds } });
  await Task.updateOne({ _id: comment.task }, { $inc: { commentsCount: -removedIds.length } });

  emitToProject(comment.project, 'comment:deleted', { taskId: String(comment.task), removedIds });
  res.json({ removedIds });
});
