import { useEffect } from 'react';
import { PRIORITIES, avatarColor, initials, cx } from '../utils/helpers';

export const Icon = ({ name, className = '', filled = false, size }) => (
  <span className={cx('material-symbols-outlined', filled && 'filled', className)} style={size ? { fontSize: size } : undefined} aria-hidden="true">
    {name}
  </span>
);

const SIZES = { xs: 'w-5 h-5 text-[9px]', sm: 'w-6 h-6 text-[10px]', md: 'w-8 h-8 text-label-sm', lg: 'w-10 h-10 text-label-lg', xl: 'w-20 h-20 text-headline-lg' };

export function Avatar({ user, size = 'md', online, ring = true, className = '' }) {
  const name = user?.name || '?';
  return (
    <span className={cx('relative inline-flex shrink-0', className)} title={name}>
      {user?.avatar ? (
        <img src={user.avatar} alt={name} className={cx('rounded-full object-cover', SIZES[size], ring && 'ring-2 ring-white')} />
      ) : (
        <span className={cx('rounded-full inline-flex items-center justify-center font-semibold', SIZES[size], avatarColor(name), ring && 'ring-2 ring-white')}>
          {initials(name)}
        </span>
      )}
      {online !== undefined && (
        <span className={cx('absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white', online ? 'bg-emerald-500' : 'bg-slate-300')} />
      )}
    </span>
  );
}

export function AvatarStack({ users = [], max = 4, size = 'md', onlineIds }) {
  const shown = users.slice(0, max);
  const extra = users.length - shown.length;
  return (
    <div className="flex items-center -space-x-2">
      {shown.map((u) => (
        <Avatar key={u._id} user={u} size={size} online={onlineIds ? onlineIds.has(u._id) : undefined} />
      ))}
      {extra > 0 && (
        <span className={cx('rounded-full inline-flex items-center justify-center font-semibold bg-surface-container-highest text-on-surface ring-2 ring-white', SIZES[size])}>+{extra}</span>
      )}
    </div>
  );
}

export const PriorityPill = ({ priority }) => {
  const p = PRIORITIES[priority] || PRIORITIES.medium;
  return (
    <span className={cx('pill', p.pill)}>
      <span className={cx('w-1.5 h-1.5 rounded-full', p.dot)} />
      {p.label}
    </span>
  );
};

export const Spinner = ({ className = '' }) => (
  <div className={cx('flex justify-center py-10', className)}>
    <div className="w-7 h-7 rounded-full border-[3px] border-primary-fixed border-t-primary animate-spin" />
  </div>
);

export const EmptyState = ({ icon = 'inbox', title, text, action }) => (
  <div className="flex flex-col items-center text-center py-14 px-6">
    <div className="w-16 h-16 rounded-2xl bg-primary-fixed text-primary flex items-center justify-center mb-4">
      <Icon name={icon} size={32} />
    </div>
    <h3 className="text-headline-sm text-on-surface">{title}</h3>
    {text && <p className="text-body-md text-on-surface-variant mt-1 max-w-sm">{text}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export const ErrorText = ({ children }) =>
  children ? (
    <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-body-sm px-3 py-2">
      <Icon name="error" size={16} className="mt-px" />
      <span>{children}</span>
    </div>
  ) : null;

export function Modal({ open = true, onClose, title, children, size = 'md', footer, fullOnMobile = false }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-5xl' };
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/40" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={cx('pop-in bg-white shadow-modal w-full flex flex-col max-h-[92vh]', widths[size], fullOnMobile ? 'h-full sm:h-auto sm:max-h-[92vh] sm:rounded-2xl' : 'rounded-t-2xl sm:rounded-2xl')}>
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
            <h2 className="text-headline-sm">{title}</h2>
            <button onClick={onClose} className="btn btn-ghost !h-8 !w-8 !p-0" aria-label="Close"><Icon name="close" /></button>
          </div>
        )}
        <div className="overflow-y-auto flex-1 min-h-0">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export const Toggle = ({ checked, onChange, label }) => (
  <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
    className={cx('relative w-10 h-6 rounded-full transition-colors shrink-0', checked ? 'bg-[#6366F1]' : 'bg-slate-300')}>
    <span className={cx('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform', checked && 'translate-x-4')} />
  </button>
);

export const ProgressBar = ({ value, color = '#6366F1', className = '' }) => (
  <div className={cx('h-1.5 rounded-full bg-surface-container-highest overflow-hidden', className)}>
    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }} />
  </div>
);
