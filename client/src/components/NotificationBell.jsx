import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useNotifications } from '../context/NotificationsContext';
import { Icon } from './ui';
import NotificationItem from './NotificationItem';

export const openNotification = (n, navigate, markRead) => {
  markRead(n._id);
  if (n.project) navigate(`/projects/${n.project}${n.task ? `?task=${n.task}` : ''}`);
};

export default function NotificationBell() {
  const { items, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} aria-label="Notifications"
        className="relative p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors">
        <Icon name="notifications" size={24} />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 min-w-4 h-4 px-1 rounded-full bg-error text-white text-[10px] font-semibold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="pop-in absolute right-0 mt-2 w-[min(24rem,calc(100vw-1.5rem))] card shadow-modal overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
            <h3 className="text-headline-sm">Notifications</h3>
            <button onClick={markAllRead} disabled={!unreadCount} className="text-label-md text-primary disabled:text-slate-400 hover:underline">Mark all as read</button>
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
            {items.length === 0 ? (
              <p className="p-8 text-center text-body-md text-slate-500">You're all caught up 🎉</p>
            ) : items.slice(0, 8).map((n) => (
              <NotificationItem key={n._id} n={n} compact onClick={() => { setOpen(false); openNotification(n, navigate, markRead); }} />
            ))}
          </div>
          <Link to="/notifications" onClick={() => setOpen(false)} className="block text-center py-2.5 text-label-lg text-primary border-t border-slate-200 hover:bg-surface-container-low">
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
