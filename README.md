# TaskFlow — MERN Project Management Tool (Trello / Asana style)

Do alag projects: `server/` (Node + Express + MongoDB + Socket.io) aur `client/` (React + Vite + Tailwind).
UI Stitch ke "TaskFlow Fluid Productivity" design system par based hai.

## Features
- Auth (register / login / JWT, "remember me", change password, profile + avatar)
- Group projects: members, roles (Admin / Member), invite by search ya email
- Kanban board: drag & drop, custom columns, task cards, filters + search
- Tasks: assign users, priority, labels, due date, subtasks (progress bar), activity log
- Comments: replies, edit/delete, @mentions, "X is typing…"
- Real-time (Socket.io): tasks, moves, comments, live presence, notifications + toasts
- Notifications: bell dropdown, full page (All / Unread / Mentions), user preferences, "due soon" reminders
- Dashboard (stats, my tasks, activity, online now, deadlines), My Tasks, Team page, Settings, global search (Ctrl/⌘ + K)
- Fully responsive (mobile drawer, horizontal snap columns, full-screen task modal)

## Run locally
Requirements: Node 18+, MongoDB running locally (ya Atlas URI).

```bash
# 1) Server
cd server
cp .env.example .env        # MONGO_URI, JWT_SECRET edit karein
npm install
npm run seed                # optional demo data (alex@taskflow.dev / password123)
npm run dev                 # http://localhost:5000

# 2) Client (new terminal)
cd client
cp .env.example .env        # VITE_API_URL=http://localhost:5000
npm install
npm run dev                 # http://localhost:5173
```

Demo users (after seed, password `password123`): alex@, sara@, ahmed@, maya@ `taskflow.dev`.
Real-time test: do browsers (ek normal, ek incognito) mein alag users se login karein.

## Folder structure
```
server/src
  index.js            entry: DB + HTTP + Socket.io + due-soon job
  app.js              express app (cors, json, routes, errors)
  models/             User, Project, Task, Comment, Notification, Activity
  controllers/        auth, user, project, task, comment, notification, dashboard, search
  routes/index.js     saare API endpoints
  middleware/         auth (JWT), error handler
  services/           access (membership checks), notify, activity, stats
  socket/index.js     socket auth, rooms, presence, typing
  jobs/dueSoon.js     due-soon notifications (har 30 min)
client/src
  api/client.js       axios + token handling
  context/            Auth, Socket, Projects, Notifications, Toast, UI
  components/         layout, modals, board (TaskCard, TaskModal), ui kit
  pages/              Auth, Dashboard, Projects, ProjectBoard, MyTasks, Team, Notifications, Settings
```

## API (prefix `/api`, protected routes need `Authorization: Bearer <token>`)
| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET/PUT /auth/me`, `PUT /auth/password` |
| Projects | `GET/POST /projects`, `GET/PUT/DELETE /projects/:id` |
| Members | `POST /projects/:id/members`, `PUT/DELETE /projects/:id/members/:userId` |
| Columns | `POST /projects/:id/columns`, `PUT/DELETE /projects/:id/columns/:columnId` |
| Tasks | `GET/POST /projects/:id/tasks`, `GET/PUT/DELETE /tasks/:id`, `PUT /tasks/:id/move`, `GET /tasks/mine`, `GET /tasks/:id/activity` |
| Comments | `GET/POST /tasks/:id/comments`, `PUT/DELETE /comments/:id` |
| Notifications | `GET /notifications`, `PUT /notifications/read-all`, `PUT /notifications/:id/read`, `DELETE /notifications/:id` |
| Other | `GET /dashboard`, `GET /search?q=`, `GET /users/search?q=`, `GET /users/online` |

## Socket.io events
Client → server: `project:join {projectId, presence}`, `project:leave`, `typing {projectId, taskId, isTyping}`
Server → client: `task:created|updated|moved|deleted`, `comment:created|updated|deleted`, `activity:new`,
`presence:update`, `presence:user`, `notification:new`, `project:added|removed|updated`, `typing`

## Deploy
- Database: MongoDB Atlas (free cluster) -> connection string
- Server: Render Web Service (root dir `server`, build `npm install`, start `npm start`)
  env: `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL` (= Netlify URL)
- Client: Netlify (base dir `client`, build `npm run build`, publish `dist`)
  env: `VITE_API_URL` (= Render URL)
