import { Avatar, Icon, PriorityPill } from '../ui';
import { cx, dayDiff, formatDue, isOverdue } from '../../utils/helpers';

export default function TaskCard({ task, onClick, dragging = false }) {
  const done = task.subtasks?.filter((s) => s.done).length || 0;
  const total = task.subtasks?.length || 0;
  const overdue = isOverdue(task);

  return (
    <div onClick={onClick} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
      className={cx('bg-white border rounded-xl p-4 cursor-pointer select-none transition-all',
        dragging ? 'border-primary shadow-drag scale-[1.02] rotate-[1.5deg]' : 'border-slate-200 shadow-card hover:shadow-card-hover hover:border-slate-300')}>
      {task.labels?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {task.labels.slice(0, 3).map((l) => <span key={l} className="pill bg-primary-fixed text-on-primary-fixed-variant">{l}</span>)}
        </div>
      )}
      <h4 className="text-body-md font-semibold text-slate-900 leading-snug">{task.title}</h4>
      {task.description && <p className="text-body-sm text-slate-500 mt-1 line-clamp-2">{task.description}</p>}

      <div className="flex items-center justify-between gap-2 mt-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm text-slate-500 min-w-0">
          <PriorityPill priority={task.priority} />
          {task.dueDate && (
            <span className={cx('inline-flex items-center gap-1', overdue && 'text-red-600 font-medium', !overdue && dayDiff(task.dueDate) === 0 && !task.isDone && 'text-amber-600 font-medium')}>
              <Icon name="event" size={14} />{formatDue(task.dueDate)}
            </span>
          )}
          {total > 0 && <span className={cx('inline-flex items-center gap-1', done === total && 'text-emerald-600')}><Icon name="checklist" size={14} />{done}/{total}</span>}
          {task.commentsCount > 0 && <span className="inline-flex items-center gap-1"><Icon name="chat_bubble_outline" size={14} />{task.commentsCount}</span>}
        </div>
        {task.assignees?.length > 0 && (
          <div className="flex -space-x-2 shrink-0">
            {task.assignees.slice(0, 3).map((u) => <Avatar key={u._id} user={u} size="sm" />)}
            {task.assignees.length > 3 && <span className="w-6 h-6 rounded-full bg-surface-container-highest text-[10px] font-semibold flex items-center justify-center ring-2 ring-white">+{task.assignees.length - 3}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
