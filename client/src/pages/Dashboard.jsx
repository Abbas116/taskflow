import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useUI } from '../context/UIContext';
import { Avatar, AvatarStack, EmptyState, Icon, PriorityPill, ProgressBar, Spinner } from '../components/ui';
import { ProjectCard } from './Projects';
import { cx, dayDiff, formatDue, isOverdue, timeAgo } from '../utils/helpers';

const StatCard = ({ label, value, icon, tone, hint, pct }) => (
  <div className="card p-4">
    <div className="flex items-center justify-between">
      <span className="text-body-sm text-on-surface-variant">{label}</span>
      <span className={cx('w-9 h-9 rounded-lg flex items-center justify-center', tone.bg, tone.text)}><Icon name={icon} size={20} /></span>
    </div>
    <div className="flex items-end justify-between mt-3">
      <span className="text-[32px] leading-none font-bold tracking-tight">{value}</span>
      {hint && <span className={cx('pill', hint.cls)}>{hint.text}</span>}
    </div>
    <ProgressBar value={pct} color={tone.bar} className="mt-4" />
  </div>
);

export default function Dashboard() {
  const { user } = useAuth();
  const { socket, onlineIds } = useSocket();
  const { openCreateProject, openQuickTask } = useUI();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('assigned');

  const load = useCallback(() => api.get('/dashboard').then((r) => setData(r.data)).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  // Real-time updates: listen to every project room (without announcing presence) and refresh on changes
  useEffect(() => {
    if (!socket || !data) return undefined;
    const ids = data.projectIds || [];
    const join = () => ids.forEach((projectId) => socket.emit('project:join', { projectId, presence: false }));
    join();
    socket.on('connect', join);
    const refresh = () => load();
    ['activity:new', 'task:created', 'task:updated', 'task:moved', 'task:deleted'].forEach((e) => socket.on(e, refresh));
    return () => {
      socket.off('connect', join);
      ['activity:new', 'task:created', 'task:updated', 'task:moved', 'task:deleted'].forEach((e) => socket.off(e, refresh));
      ids.forEach((projectId) => socket.emit('project:leave', { projectId }));
    };
  }, [socket, data?.projectIds?.join(','), load]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return <Spinner className="py-24" />;
  const { stats, tasks, recentProjects, activity, upcoming, teammates } = data;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const list = tasks[tab] || [];
  const tabs = [['assigned', 'Assigned to Me', tasks.assigned.length], ['dueSoon', 'Due Soon', tasks.dueSoon.length], ['created', 'Created by Me', tasks.created.length]];
  const onlineMates = teammates.filter((t) => onlineIds.has(t._id));

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="text-label-md text-on-surface-variant">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
          <h1 className="text-headline-xl-mobile sm:text-headline-xl mt-1">{greeting}, {user.name.split(' ')[0]} 👋</h1>
          <p className="text-body-lg text-on-surface-variant mt-1">Here is what's happening across your <b className="text-on-surface">{stats.totalProjects} active projects</b> today.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-outline" onClick={openQuickTask}><Icon name="add_task" size={18} />Quick Task</button>
          <button className="btn btn-primary" onClick={openCreateProject}><Icon name="add_circle" size={18} />Create Project</button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Active Projects" value={stats.totalProjects} icon="folder_open" tone={{ bg: 'bg-primary-fixed', text: 'text-primary', bar: '#6366F1' }} pct={Math.min(100, stats.totalProjects * 10)} />
        <StatCard label="Tasks Assigned to Me" value={stats.assignedToMe} icon="task_alt" tone={{ bg: 'bg-secondary-fixed', text: 'text-secondary', bar: '#645efb' }}
          hint={{ text: `${stats.dueToday} due today`, cls: 'bg-primary-fixed text-primary' }} pct={Math.min(100, stats.assignedToMe * 10)} />
        <StatCard label="Due Today" value={stats.dueToday} icon="event_busy" tone={{ bg: 'bg-red-50', text: 'text-red-500', bar: '#EF4444' }}
          hint={stats.overdue ? { text: `${stats.overdue} overdue`, cls: 'bg-red-50 text-red-600' } : null} pct={Math.min(100, stats.dueToday * 20)} />
        <StatCard label="Completed This Week" value={stats.completedThisWeek} icon="done_all" tone={{ bg: 'bg-emerald-50', text: 'text-emerald-600', bar: '#10B981' }} pct={Math.min(100, stats.completedThisWeek * 5)} />
      </div>

      <div className="grid xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6 min-w-0">
          <section className="card overflow-hidden">
            <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-headline-md">My Urgent & Recent Tasks</h2>
                <p className="text-body-sm text-on-surface-variant">High-priority deliverables in your workflow</p>
              </div>
              <div className="flex p-1 rounded-lg bg-surface-container-low text-label-md overflow-x-auto no-scrollbar">
                {tabs.map(([k, label, n]) => (
                  <button key={k} onClick={() => setTab(k)} className={cx('px-3 py-1.5 rounded-md whitespace-nowrap transition', tab === k ? 'bg-white shadow-sm text-primary font-semibold' : 'text-on-surface-variant')}>{label} ({n})</button>
                ))}
              </div>
            </div>
            {list.length === 0 ? <EmptyState icon="celebration" title="Nothing here" text="No tasks in this view. Enjoy the calm!" /> : (
              <ul className="divide-y divide-slate-100">
                {list.map((t) => (
                  <li key={t._id}>
                    <button onClick={() => navigate(`/projects/${t.project._id}?task=${t._id}`)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-container-low text-left transition-colors">
                      <span className="w-[18px] h-[18px] rounded border-[1.5px] border-slate-300 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span className="pill bg-primary-fixed text-on-primary-fixed-variant"><span className="w-1.5 h-1.5 rounded-full" style={{ background: t.project.color }} />{t.project.name}</span>
                          <PriorityPill priority={t.priority} />
                        </span>
                        <span className="block text-body-md font-medium text-slate-900 truncate">{t.title}</span>
                      </span>
                      {t.dueDate && <span className={cx('pill shrink-0', isOverdue(t) ? 'bg-red-50 text-red-600' : dayDiff(t.dueDate) === 0 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600')}><Icon name="schedule" size={14} />{formatDue(t.dueDate)}</span>}
                      <span className="hidden sm:block"><AvatarStack users={t.assignees} max={2} size="sm" /></span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center justify-between px-4 py-3 bg-surface-container-low text-body-sm text-on-surface-variant">
              <span>Showing {list.length} of {stats.assignedToMe} tasks</span>
              <Link to="/my-tasks" className="text-primary font-semibold flex items-center gap-1">View All Tasks <Icon name="arrow_forward" size={16} /></Link>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <div><h2 className="text-headline-md">Recent Projects</h2><p className="text-body-sm text-on-surface-variant">Track status, completion pace and contributors</p></div>
              <Link to="/projects" className="text-label-lg text-primary">Explore All ({stats.totalProjects})</Link>
            </div>
            {recentProjects.length === 0 ? (
              <div className="card"><EmptyState icon="folder_open" title="No projects yet" text="Create a project to see it here." action={<button className="btn btn-primary" onClick={openCreateProject}>Create project</button>} /></div>
            ) : <div className="grid md:grid-cols-3 gap-4">{recentProjects.map((p) => <ProjectCard key={p._id} p={p} />)}</div>}
          </section>
        </div>

        <div className="space-y-6 min-w-0">
          <section className="card p-4">
            <div className="flex items-center justify-between mb-4"><h2 className="text-headline-sm flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />Real-time Updates</h2></div>
            {activity.length === 0 ? <p className="text-body-sm text-slate-500">No activity yet.</p> : (
              <ul className="space-y-4">
                {activity.map((a) => (
                  <li key={a._id} className="flex gap-3">
                    <Avatar user={a.actor} size="md" ring={false} />
                    <div className="min-w-0 text-body-sm">
                      <p><b>{a.actor?.name}</b> {a.text}{a.task && <> — <Link className="text-primary font-medium" to={`/projects/${a.project?._id}?task=${a.task._id}`}>{a.task.title}</Link></>}</p>
                      <p className="text-slate-400 mt-0.5">{timeAgo(a.createdAt)} · {a.project?.name}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-4">
            <h2 className="text-headline-sm">Online Now</h2>
            <p className="text-body-sm text-on-surface-variant mb-3">{onlineMates.length} teammate{onlineMates.length === 1 ? '' : 's'} active</p>
            {teammates.length === 0 ? <p className="text-body-sm text-slate-500">Invite teammates to your projects to collaborate.</p> : (
              <div className="flex flex-wrap gap-2">{teammates.map((t) => <Avatar key={t._id} user={t} size="md" online={onlineIds.has(t._id)} />)}</div>
            )}
          </section>

          <section className="card p-4">
            <div className="flex items-center justify-between mb-3"><h2 className="text-headline-sm">Upcoming Deadlines</h2><span className="text-label-md text-slate-500">Next 7 days</span></div>
            {upcoming.length === 0 ? <p className="text-body-sm text-slate-500">No deadlines this week.</p> : (
              <ul className="space-y-3">
                {upcoming.map((t) => {
                  const d = new Date(t.dueDate);
                  return (
                    <li key={t._id}>
                      <Link to={`/projects/${t.project._id}?task=${t._id}`} className="flex items-center gap-3 group">
                        <span className="w-11 h-11 rounded-lg bg-red-50 text-red-600 flex flex-col items-center justify-center leading-none shrink-0">
                          <span className="text-[10px] font-semibold uppercase">{d.toLocaleDateString('en-US', { month: 'short' })}</span>
                          <span className="text-body-lg font-bold">{d.getDate()}</span>
                        </span>
                        <span className="min-w-0 flex-1"><span className="block text-body-md font-medium truncate group-hover:text-primary">{t.title}</span><span className="block text-body-sm text-slate-500 truncate">{t.project.name}</span></span>
                        <Icon name="chevron_right" className="text-slate-400" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
