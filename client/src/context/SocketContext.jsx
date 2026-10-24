import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import api, { API_URL, getToken } from '../api/client';
import { useAuth } from './AuthContext';

const SocketContext = createContext({ socket: null, onlineIds: new Set() });
export const useSocket = () => useContext(SocketContext);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [onlineIds, setOnlineIds] = useState(new Set());
  const userId = user?._id;

  useEffect(() => {
    if (!userId) return undefined;
    const s = io(API_URL, { auth: { token: getToken() }, transports: ['websocket', 'polling'] });
    setSocket(s);

    // who is online right now + live updates
    const loadOnline = () => api.get('/users/online').then((r) => setOnlineIds(new Set(r.data))).catch(() => {});
    s.on('connect', loadOnline);
    s.on('presence:user', ({ userId: id, online }) =>
      setOnlineIds((prev) => {
        const next = new Set(prev);
        online ? next.add(id) : next.delete(id);
        return next;
      })
    );

    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [userId]);

  return <SocketContext.Provider value={{ socket, onlineIds }}>{children}</SocketContext.Provider>;
}
