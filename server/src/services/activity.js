import Activity from '../models/Activity.js';
import { emitToProject } from '../socket/index.js';

export async function logActivity({ project, task = null, actor, text }) {
  const doc = await Activity.create({ project, task, actor: actor._id, text });
  const payload = {
    _id: doc._id,
    project: doc.project,
    task: doc.task,
    text: doc.text,
    createdAt: doc.createdAt,
    actor: { _id: actor._id, name: actor.name, avatar: actor.avatar },
  };
  emitToProject(project, 'activity:new', payload);
  return payload;
}
