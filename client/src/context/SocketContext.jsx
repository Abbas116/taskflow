import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { API_URL, getToken } from '../api/client';

// On Vercel the socket function lives at /api/socket-io/socket.io (set VITE_SOCKET_PATH). Locally the default works.
const SOCKET_PATH = import.meta.env.VITE_SOCKET_PATH || '/socket.io';
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
    const s = io(API_URL, { path: SOCKET_PATH, auth: { token: getToken() }, transports: ['websocket'] });
    setSocket(s);

    // who is online right now + live updates
    // ask the server who is online (also re-asked after every reconnect, e.g. when a Vercel function times out)
    const loadOnline = () => s.emit('presence:online', (ids) => Array.isArray(ids) && setOnlineIds(new Set(ids)));
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
