import { Avatar, Icon } from './ui';
import { NOTIF_META, cx, timeAgo } from '../utils/helpers';

export default function NotificationItem({ n, onClick, onDelete, compact = false }) {
  const meta = NOTIF_META[n.type] || NOTIF_META.comment;
  return (
    <div role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
      className={cx('group flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-surface-container-low', !n.read && 'bg-primary-fixed/40')}>
      <span className={cx('w-9 h-9 rounded-full flex items-center justify-center shrink-0', meta.color)}><Icon name={meta.icon} size={18} /></span>
      <div className="min-w-0 flex-1">
        <p className={cx('text-body-md text-on-surface', !n.read && 'font-medium')}>{n.message}</p>
        <p className="text-body-sm text-slate-500 mt-0.5">{timeAgo(n.createdAt)}</p>
      </div>
      {!n.read && <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" aria-label="Unread" />}
      {!compact && onDelete && (
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition" aria-label="Delete notification">
          <Icon name="delete" size={18} />
        </button>
      )}
      {n.actor && compact && <Avatar user={n.actor} size="xs" ring={false} className="hidden" />}
    </div>
  );
}
