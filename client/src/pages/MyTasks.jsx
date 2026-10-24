import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api/client';
import { useToast } from '../context/ToastContext';
import { useSocket } from '../context/SocketContext';
import { AvatarStack, EmptyState, Icon, PriorityPill, Spinner } from '../components/ui';
import { cx, dayDiff, formatDue, isOverdue } from '../utils/helpers';

const dueGroup = (t) => {
  if (t.isDone) return 'Completed';
  if (!t.dueDate) return 'No due date';
  const d = dayDiff(t.dueDate);
  if (d < 0) return 'Overdue';
  if (d === 0) return 'Today';
  if (d <= 7) return 'This week';
  return 'Later';
};
const DUE_ORDER = ['Overdue', 'Today', 'This week', 'Later', 'No due date', 'Completed'];

export default function MyTasks() {
  const navigate = useNavigate();
  const toast = useToast();
  const { socket } = useSocket();
  const [tasks, setTasks] = useState(null);
  const [groupBy, setGroupBy] = useState('due');
  const [f, setF] = useState({ q: '', status: 'open', priority: '', project: '' });
  const [sort, setSort] = useState('due');

  const load = () => api.get('/tasks/mine').then((r) => setTasks(r.data)).catch((e) => toast(errMsg(e), 'error'));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // refresh when a new task is assigned to me
  useEffect(() => {
    if (!socket) return undefined;
    const h = (n) => n.type === 'task_assigned' && load();
    socket.on('notification:new', h);
    return () => socket.off('notification:new', h);
  }, [socket]); // eslint-disable-line react-hooks/exhaustive-deps

  const projects = useMemo(() => {
    const m = new Map();
    (tasks || []).forEach((t) => m.set(t.project._id, t.project));
    return [...m.values()];
  }, [tasks]);

  const toggleDone = async (t) => {
    const cols = t.project.columns;
    const target = t.isDone ? cols.find((c) => !c.isDone) : cols.find((c) => c.isDone);
    if (!target) return toast('This project has no matching column', 'error');
    setTasks((p) => p.map((x) => (x._id === t._id ? { ...x, isDone: !t.isDone, columnName: target.name } : x)));
    try { await api.put(`/tasks/${t._id}/move`, { columnId: target._id }); } catch (e) { toast(errMsg(e), 'error'); load(); }
  };

  const filtered = useMemo(() => {
    let list = (tasks || []).filter((t) => {
      if (f.status === 'open' && t.isDone) return false;
      if (f.status === 'done' && !t.isDone) return false;
      if (f.priority && t.priority !== f.priority) return false;
      if (f.project && t.project._id !== f.project) return false;
      if (f.q && !t.title.toLowerCase().includes(f.q.toLowerCase())) return false;
      return true;
    });
    const rank = { urgent: 0, high: 1, medium: 2, low: 3 };
    list = [...list].sort((a, b) => {
      if (sort === 'priority') return rank[a.priority] - rank[b.priority];
      if (sort === 'title') return a.title.localeCompare(b.title);
      if (!a.dueDate && !b.dueDate) return 0;
      return !a.dueDate ? 1 : !b.dueDate ? -1 : new Date(a.dueDate) - new Date(b.dueDate);
    });
    return list;
  }, [tasks, f, sort]);

  const groups = useMemo(() => {
    const map = new Map();
    filtered.forEach((t) => {
      const key = groupBy === 'project' ? t.project.name : dueGroup(t);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(t);
    });
    const keys = [...map.keys()].sort((a, b) => (groupBy === 'due' ? DUE_ORDER.indexOf(a) - DUE_ORDER.indexOf(b) : a.localeCompare(b)));
    return keys.map((k) => [k, map.get(k)]);
  }, [filtered, groupBy]);

  if (!tasks) return <Spinner className="py-24" />;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <h1 className="text-headline-lg">My Tasks</h1>
      <p className="text-body-md text-on-surface-variant mb-5">Everything assigned to you across all projects.</p>

      <div className="card p-3 mb-5 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]"><Icon name="search" className="absolute left-2.5 top-2 text-slate-400" size={18} /><input className="input !h-9 pl-9" placeholder="Search my tasks…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} /></div>
        <select className="input !h-9 !w-auto" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="open">Open</option><option value="done">Completed</option><option value="all">All</option></select>
        <select className="input !h-9 !w-auto" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}><option value="">Any priority</option><option value="urgent">Urgent</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>
        <select className="input !h-9 !w-auto" value={f.project} onChange={(e) => setF({ ...f, project: e.target.value })}><option value="">All projects</option>{projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select>
        <select className="input !h-9 !w-auto" value={sort} onChange={(e) => setSort(e.target.value)}><option value="due">Sort: Due date</option><option value="priority">Sort: Priority</option><option value="title">Sort: Title</option></select>
        <div className="flex p-1 rounded-lg bg-surface-container-low text-label-md">
          {[['due', 'By due date'], ['project', 'By project']].map(([k, l]) => <button key={k} onClick={() => setGroupBy(k)} className={cx('px-3 py-1 rounded-md', groupBy === k ? 'bg-white shadow-sm text-primary font-semibold' : 'text-on-surface-variant')}>{l}</button>)}
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="card"><EmptyState icon="task_alt" title="No tasks found" text={tasks.length ? 'Try adjusting your filters.' : 'Tasks assigned to you will show up here.'} /></div>
      ) : groups.map(([name, list]) => (
        <section key={name} className="mb-5">
          <h2 className={cx('text-label-lg mb-2 flex items-center gap-2', name === 'Overdue' ? 'text-red-600' : 'text-slate-700')}>{name}<span className="pill bg-white border border-slate-200 text-slate-500">{list.length}</span></h2>
          <div className="card overflow-hidden divide-y divide-slate-100">
            {list.map((t) => (
              <div key={t._id} className="flex items-center gap-3 px-4 min-h-[48px] py-2 hover:bg-slate-50 transition-colors">
                <input type="checkbox" checked={t.isDone} onChange={() => toggleDone(t)} className="w-[18px] h-[18px] rounded accent-emerald-500 cursor-pointer shrink-0" aria-label="Mark complete" />
                <button onClick={() => navigate(`/projects/${t.project._id}?task=${t._id}`)} className="flex-1 min-w-0 text-left">
                  <span className={cx('block text-body-md font-medium truncate', t.isDone && 'line-through text-slate-400')}>{t.title}</span>
                  <span className="flex items-center gap-2 text-body-sm text-slate-500 mt-0.5"><span className="w-2 h-2 rounded-full" style={{ background: t.project.color }} />{t.project.name}<span className="text-slate-300">•</span>{t.columnName}</span>
                </button>
                <span className="hidden sm:block"><PriorityPill priority={t.priority} /></span>
                {t.dueDate && <span className={cx('pill shrink-0', isOverdue(t) ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600')}><Icon name="event" size={14} />{formatDue(t.dueDate)}</span>}
                <span className="hidden md:block"><AvatarStack users={t.assignees} max={3} size="sm" /></span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
