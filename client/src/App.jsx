import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ProjectsProvider } from './context/ProjectsContext';
import { NotificationsProvider } from './context/NotificationsContext';
import AppLayout from './components/AppLayout';
import { Spinner } from './components/ui';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectBoard from './pages/ProjectBoard';
import MyTasks from './pages/MyTasks';
import Team from './pages/Team';
import Notifications from './pages/Notifications';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';

// Everything inside requires a logged-in user; providers only mount after login
function ProtectedApp() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner className="py-40" />;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <SocketProvider>
      <ProjectsProvider>
        <NotificationsProvider>
          <Outlet />
        </NotificationsProvider>
      </ProjectsProvider>
    </SocketProvider>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      <Route element={<ProtectedApp />}>
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="my-tasks" element={<MyTasks />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:projectId" element={<ProjectBoard />} />
          <Route path="team" element={<Team />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  );
}
