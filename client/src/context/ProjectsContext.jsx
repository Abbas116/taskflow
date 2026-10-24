import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import { useToast } from './ToastContext';

const ProjectsContext = createContext(null);
export const useProjects = () => useContext(ProjectsContext);

export function ProjectsProvider({ children }) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const toast = useToast();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get('/projects');
      setProjects(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) refresh();
  }, [user, refresh]);

  useEffect(() => {
    if (!socket) return undefined;
    const onAdded = (project) => {
      toast(`You were added to "${project.name}"`, 'info', 'group_add');
      refresh();
    };
    const onRemoved = ({ projectId }) => {
      refresh();
      if (window.location.pathname.startsWith(`/projects/${projectId}`)) {
        toast('You no longer have access to that project', 'error');
        navigate('/projects');
      }
    };
    socket.on('project:added', onAdded);
    socket.on('project:removed', onRemoved);
    return () => {
      socket.off('project:added', onAdded);
      socket.off('project:removed', onRemoved);
    };
  }, [socket, refresh, toast, navigate]);

  return <ProjectsContext.Provider value={{ projects, loading, refresh }}>{children}</ProjectsContext.Provider>;
}
