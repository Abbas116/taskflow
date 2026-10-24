import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useProjects } from '../context/ProjectsContext';
import { useNotifications } from '../context/NotificationsContext';
import { UIContext } from '../context/UIContext';
import { Avatar, Icon } from './ui';
import NotificationBell from './NotificationBell';
import GlobalSearch from './GlobalSearch';
import CreateProjectModal from './CreateProjectModal';
import QuickTaskModal from './QuickTaskModal';
import { cx } from '../utils/helpers';

const NAV = [
  { to: '/', label: 'Dashboard', icon: 'home', end: true },
  { to: '/my-tasks', label: 'My Tasks', icon: 'check_circle' },
  { to: '/projects', label: 'Projects', icon: 'folder', end: true },
  { to: '/team', label: 'Team / Members', icon: 'group' },
  { to: '/notifications', label: 'Notifications', icon: 'notifications' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
];

function Sidebar({ onNavigate, onCreateProject }) {
  const { projects } = useProjects();
  const { unreadCount } = useNotifications();
  const link = ({ isActive }) =>
    cx('flex items-center justify-between px-2 py-1.5 rounded-lg transition-all text-body-md',
      isActive ? 'bg-primary-container text-on-primary-container font-semibold shadow-sm' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface');

  return (
    <div className="h-full flex flex-col bg-white overflow-y-auto">
      <div className="p-4 flex items-center gap-2">
        <span className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center"><Icon name="view_kanban" size={20} filled /></span>
        <span className="text-headline-sm">TaskFlow</span>
      </div>

      <nav className="px-4 mt-2" onClick={onNavigate}>
        <p className="text-label-sm uppercase tracking-wider text-on-surface-variant px-1 mb-1">Navigation</p>
        <div className="flex flex-col gap-1">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={link}>
              <span className="flex items-center gap-2"><Icon name={n.icon} />{n.label}</span>
              {n.to === '/notifications' && unreadCount > 0 && <span className="w-2 h-2 rounded-full bg-error" />}
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="px-4 mt-6 flex-1">
        <div className="flex items-center justify-between px-1 mb-1">
          <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">Projects</span>
          <button onClick={onCreateProject} className="p-0.5 rounded hover:bg-surface-container text-on-surface-variant" title="Create new project"><Icon name="add" size={18} /></button>
        </div>
        <div className="flex flex-col gap-1" onClick={onNavigate}>
          {projects.map((p) => (
            <NavLink key={p._id} to={`/projects/${p._id}`} className={link}>
              <span className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }} />
                <span className="truncate">{p.name}</span>
              </span>
            </NavLink>
          ))}
          <button onClick={() => { onNavigate?.(); onCreateProject(); }} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-primary hover:bg-surface-container-high text-label-md text-left">
            <Icon name="add_circle" size={18} /> New Project
          </button>
        </div>
      </div>

      <div className="p-4">
        <Link to="/team" onClick={onNavigate} className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary-fixed text-on-primary-fixed-variant hover:bg-primary-fixed-dim transition-colors text-label-md">
          <Icon name="person_add" size={18} /> Invite Team
        </Link>
      </div>
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
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
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 pl-1">
        <Avatar user={user} size="md" ring={false} />
        <span className="hidden md:flex flex-col text-left">
          <span className="text-label-md leading-tight">{user.name}</span>
          <span className="text-label-sm text-on-surface-variant leading-tight font-normal">{user.title || 'Team member'}</span>
        </span>
        <Icon name="expand_more" className="hidden md:block text-on-surface-variant" size={18} />
      </button>
      {open && (
        <div className="pop-in absolute right-0 mt-2 w-52 card shadow-modal py-1 z-50">
          <button onClick={() => { setOpen(false); navigate('/settings'); }} className="w-full flex items-center gap-2 px-4 py-2 text-body-md hover:bg-surface-container-low"><Icon name="settings" size={18} />Settings</button>
          <button onClick={logout} className="w-full flex items-center gap-2 px-4 py-2 text-body-md text-red-600 hover:bg-red-50"><Icon name="logout" size={18} />Log out</button>
        </div>
      )}
    </div>
  );
}

export default function AppLayout() {
  const [drawer, setDrawer] = useState(false);
  const [creating, setCreating] = useState(false);
  const [quickTask, setQuickTask] = useState(false);
  const location = useLocation();
  useEffect(() => setDrawer(false), [location.pathname]);

  // when on a board, the quick-task modal defaults to that project
  const boardId = location.pathname.match(/^\/projects\/([a-f0-9]{24})/)?.[1];

  return (
    <UIContext.Provider value={{ openCreateProject: () => setCreating(true), openQuickTask: () => setQuickTask(true) }}>
      <aside className="hidden lg:block fixed left-0 top-0 h-full w-64 z-30 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
        <Sidebar onCreateProject={() => setCreating(true)} />
      </aside>

      {drawer && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-72 max-w-[85%] h-full shadow-modal pop-in"><Sidebar onNavigate={() => setDrawer(false)} onCreateProject={() => setCreating(true)} /></div>
          <div className="flex-1 bg-slate-900/40" onClick={() => setDrawer(false)} />
        </div>
      )}

      <div className="lg:pl-64 min-h-screen flex flex-col">
        <header className="sticky top-0 z-20 h-16 bg-surface/80 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] flex items-center gap-3 px-4 lg:px-6">
          <button className="lg:hidden p-1.5 rounded-lg hover:bg-surface-container" onClick={() => setDrawer(true)} aria-label="Open menu"><Icon name="menu" size={24} /></button>
          <GlobalSearch />
          <div className="flex-1" />
          <button onClick={() => setQuickTask(true)} className="btn btn-primary btn-sm"><Icon name="add" size={18} /><span className="hidden sm:inline">New Task</span></button>
          <NotificationBell />
          <UserMenu />
        </header>
        <main className="flex-1 min-w-0"><Outlet /></main>
      </div>

      {creating && <CreateProjectModal onClose={() => setCreating(false)} />}
      {quickTask && <QuickTaskModal defaultProjectId={boardId} onClose={() => setQuickTask(false)} />}
    </UIContext.Provider>
  );
}
