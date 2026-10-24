import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import * as auth from '../controllers/authController.js';
import * as users from '../controllers/userController.js';
import * as projects from '../controllers/projectController.js';
import * as tasks from '../controllers/taskController.js';
import * as comments from '../controllers/commentController.js';
import * as notifications from '../controllers/notificationController.js';
import { dashboard } from '../controllers/dashboardController.js';
import { search } from '../controllers/searchController.js';

const router = Router();

router.get('/health', (_req, res) => res.json({ status: 'ok' }));

/* auth (public) */
router.post('/auth/register', auth.register);
router.post('/auth/login', auth.login);

/* everything below needs a valid JWT */
router.use(protect);

router.get('/auth/me', auth.me);
router.put('/auth/me', auth.updateMe);
router.put('/auth/password', auth.changePassword);

router.get('/users/search', users.searchUsers);
router.get('/users/online', users.onlineUsers);

router.get('/dashboard', dashboard);
router.get('/search', search);

/* projects, members, columns */
router.route('/projects').get(projects.listProjects).post(projects.createProject);
router
  .route('/projects/:projectId')
  .get(projects.getProject)
  .put(projects.updateProject)
  .delete(projects.deleteProject);
router.post('/projects/:projectId/members', projects.addMember);
router.put('/projects/:projectId/members/:userId', projects.updateMemberRole);
router.delete('/projects/:projectId/members/:userId', projects.removeMember);
router.post('/projects/:projectId/columns', projects.addColumn);
router.put('/projects/:projectId/columns/:columnId', projects.updateColumn);
router.delete('/projects/:projectId/columns/:columnId', projects.deleteColumn);

/* tasks */
router.route('/projects/:projectId/tasks').get(tasks.listProjectTasks).post(tasks.createTask);
router.get('/tasks/mine', tasks.myTasks); // must stay above /tasks/:id
router.route('/tasks/:id').get(tasks.getTask).put(tasks.updateTask).delete(tasks.deleteTask);
router.put('/tasks/:id/move', tasks.moveTask);
router.get('/tasks/:id/activity', tasks.taskActivity);

/* comments */
router.route('/tasks/:id/comments').get(comments.listComments).post(comments.createComment);
router.route('/comments/:id').put(comments.updateComment).delete(comments.deleteComment);

/* notifications */
router.get('/notifications', notifications.listNotifications);
router.put('/notifications/read-all', notifications.markAllRead);
router.put('/notifications/:id/read', notifications.markRead);
router.delete('/notifications/:id', notifications.deleteNotification);

export default router;
