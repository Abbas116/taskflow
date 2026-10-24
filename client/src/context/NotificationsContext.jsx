import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import { useToast } from './ToastContext';
import { NOTIF_META } from '../utils/helpers';

const NotificationsContext = createContext(null);
export const useNotifications = () => useContext(NotificationsContext);

export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    const { data } = await api.get('/notifications');
    setItems(data.notifications);
    setUnreadCount(data.unreadCount);
  }, []);

  useEffect(() => {
    if (user) load().catch(() => {});
  }, [user, load]);

  // real-time: a new notification arrives through the user's personal socket room
  useEffect(() => {
    if (!socket) return undefined;
    const onNew = (n) => {
      setItems((prev) => [n, ...prev]);
      setUnreadCount((c) => c + 1);
      toast(n.message, 'info', NOTIF_META[n.type]?.icon);
    };
    socket.on('notification:new', onNew);
    return () => socket.off('notification:new', onNew);
  }, [socket, toast]);

  const markRead = async (id) => {
    const target = items.find((n) => n._id === id);
    if (!target || target.read) return;
    setItems((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    api.put(`/notifications/${id}/read`).catch(() => {});
  };

  const markAllRead = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    api.put('/notifications/read-all').catch(() => {});
  };

  const remove = async (id) => {
    const target = items.find((n) => n._id === id);
    setItems((prev) => prev.filter((n) => n._id !== id));
    if (target && !target.read) setUnreadCount((c) => Math.max(0, c - 1));
    api.delete(`/notifications/${id}`).catch(() => {});
  };

  return (
    <NotificationsContext.Provider value={{ items, unreadCount, markRead, markAllRead, remove, reload: load }}>
      {children}
    </NotificationsContext.Provider>
  );
}
