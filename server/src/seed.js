// Optional demo data:  npm run seed   (all demo users use the password "password123")
import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from './config/db.js';
import User from './models/User.js';
import Project from './models/Project.js';
import Task from './models/Task.js';
import Comment from './models/Comment.js';
import Activity from './models/Activity.js';
import Notification from './models/Notification.js';

await connectDB();
await Promise.all([User, Project, Task, Comment, Activity, Notification].map((m) => m.deleteMany({})));

const [alex, sara, ahmed, maya] = await User.create([
  { name: 'Alex Morgan', email: 'alex@taskflow.dev', password: 'password123', title: 'Product Lead' },
  { name: 'Sara Khan', email: 'sara@taskflow.dev', password: 'password123', title: 'UX Lead' },
  { name: 'Ahmed Tariq', email: 'ahmed@taskflow.dev', password: 'password123', title: 'Frontend Engineer' },
  { name: 'Maya Lin', email: 'maya@taskflow.dev', password: 'password123', title: 'Visual Designer' },
]);

const mk = (name, description, color, icon, owner, others) =>
  Project.create({
    name, description, color, icon, owner: owner._id,
    members: [{ user: owner._id, role: 'admin' }, ...others.map((u) => ({ user: u._id, role: 'member' }))],
  });

const web = await mk('Website Redesign', 'Sprint 14: core components and homepage wireframes', '#6366F1', 'web', alex, [sara, ahmed, maya]);
const mobile = await mk('Mobile App Launch', 'Native iOS & Android release', '#8B5CF6', 'smartphone', alex, [ahmed, maya]);

const cols = (p) => Object.fromEntries(p.columns.map((c) => [c.name, c]));
const day = (n) => new Date(Date.now() + n * 864e5);
const webCols = cols(web);

const seedTasks = [
  ['Conduct user interviews on homepage navigation', 'To Do', 'medium', 3, [sara], ['User Research', 'UX']],
  ['Audit typography and color contrast', 'To Do', 'low', 5, [maya], ['Accessibility']],
  ['Design component library in Figma', 'In Progress', 'high', 1, [maya, sara], ['Design System']],
  ['Finalize dark mode color tokens', 'In Progress', 'urgent', 0, [maya], ['Tokens']],
  ['Responsive breakpoint testing on Safari', 'In Review', 'high', 2, [ahmed], ['QA', 'Frontend']],
  ['Launch marketing landing page', 'Done', 'medium', -1, [alex, ahmed], ['Marketing']],
];

for (const [i, [title, col, priority, due, assignees, labels]] of seedTasks.entries()) {
  const column = webCols[col];
  const order = seedTasks.slice(0, i).filter((t) => t[1] === col).length;
  const task = await Task.create({
    project: web._id, title, column: column._id, order, priority, labels,
    description: 'Seeded demo task.', dueDate: day(due), assignees: assignees.map((u) => u._id),
    createdBy: alex._id, isDone: column.isDone, completedAt: column.isDone ? new Date() : null,
    subtasks: [{ title: 'Draft', done: true }, { title: 'Review', done: false }],
  });
  await Activity.create({ project: web._id, task: task._id, actor: alex._id, text: `created this task in ${col}` });
}

const t = await Task.findOne({ project: web._id, title: /component library/ });
await Comment.create({ task: t._id, project: web._id, author: sara._id, text: 'Updated the button variants to match design system v2.3!' });
await Task.updateOne({ _id: t._id }, { commentsCount: 1 });

const mobCols = cols(mobile);
await Task.create({ project: mobile._id, title: 'Review App Store screenshots', column: mobCols['To Do']._id, order: 0, priority: 'medium', dueDate: day(0), assignees: [alex._id], createdBy: ahmed._id });

console.log('Seeded! Login with alex@taskflow.dev / password123');
await mongoose.disconnect();
