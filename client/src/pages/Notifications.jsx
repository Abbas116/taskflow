import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../context/NotificationsContext';
import { EmptyState } from '../components/ui';
import NotificationItem from '../components/NotificationItem';
import { openNotification } from '../components/NotificationBell';
import { cx } from '../utils/helpers';

export default function Notifications() {
  const { items, unreadCount, markRead, markAllRead, remove } = useNotifications();
  const navigate = useNavigate();
  const [tab, setTab] = useState('all');

  const list = items.filter((n) => (tab === 'unread' ? !n.read : tab === 'mentions' ? n.type === 'mention' : true));
  const tabs = [['all', 'All', items.length], ['unread', 'Unread', unreadCount], ['mentions', 'Mentions', items.filter((n) => n.type === 'mention').length]];

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5 gap-3">
        <div><h1 className="text-headline-lg">Notifications</h1><p className="text-body-md text-on-surface-variant">Updates arrive here in real time.</p></div>
        <button className="btn btn-outline btn-sm" onClick={markAllRead} disabled={!unreadCount}>Mark all as read</button>
      </div>
      <div className="flex gap-1 border-b border-slate-200 mb-4">
        {tabs.map(([k, label, n]) => (
          <button key={k} onClick={() => setTab(k)} className={cx('px-4 py-2 text-label-lg border-b-2 -mb-px flex items-center gap-2', tab === k ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800')}>
            {label}<span className={cx('pill', tab === k ? 'bg-primary-fixed text-primary' : 'bg-slate-100 text-slate-500')}>{n}</span>
          </button>
        ))}
      </div>
      <div className="card overflow-hidden divide-y divide-slate-100">
        {list.length === 0 ? (
          <EmptyState icon="notifications_off" title={tab === 'unread' ? "You're all caught up" : 'No notifications'} text="When someone assigns you a task, comments or mentions you, it will show up here." />
        ) : list.map((n) => <NotificationItem key={n._id} n={n} onClick={() => openNotification(n, navigate, markRead)} onDelete={() => remove(n._id)} />)}
      </div>
    </div>
  );
}
