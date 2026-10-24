import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import api, { errMsg } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import { Avatar, AvatarStack, Icon, Spinner } from '../components/ui';
import TaskCard from '../components/board/TaskCard';
import TaskModal from '../components/board/TaskModal';
import ProjectSettingsModal from '../components/board/ProjectSettingsModal';
import InviteModal from '../components/InviteModal';
import NotFound from './NotFound';
import { cx, dayDiff } from '../utils/helpers';

const colTasks = (tasks, colId) => tasks.filter((t) => String(t.column) === String(colId)).sort((a, b) => a.order - b.order);

// Apply the server's authoritative ordering ({columnId: [taskIds...]}) to the local task list
const applyOrders = (tasks, task, orders) => {
  const pos = {};
  Object.entries(orders).forEach(([col, ids]) => ids.forEach((id, i) => { pos[id] = { column: col, order: i }; }));
  return tasks.map((t) => (t._id === task._id ? { ...t, ...task } : t)).map((t) => (pos[t._id] ? { ...t, ...pos[t._id] } : t));
};

function AddCard({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const submit = async () => {
    if (!title.trim()) return setOpen(false);
    const t = title;
    setTitle('');
    await onAdd(t);
  };
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-body-md text-slate-500 hover:bg-white hover:text-primary border border-transparent hover:border-slate-200 transition">
        <Icon name="add" size={18} /> Add card
      </button>
    );
  }
  return (
    <div className="space-y-2">
      <textarea autoFocus rows={2} className="textarea" placeholder="Task title…" value={title} onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } if (e.key === 'Escape') setOpen(false); }} />
      <div className="flex gap-2"><button className="btn btn-primary btn-sm" onClick={submit}>Add card</button><button className="btn btn-ghost btn-sm" onClick={() => { setOpen(false); setTitle(''); }}>Cancel</button></div>
    </div>
  );
}

function ColumnMenu({ column, onRename, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="p-1 rounded text-slate-500 hover:bg-white" aria-label="Column options"><Icon name="more_horiz" size={20} /></button>
      {open && (
        <div className="pop-in absolute right-0 mt-1 w-40 card shadow-drag py-1 z-30">
          <button className="w-full px-3 py-2 text-left text-body-md hover:bg-surface-container-low flex items-center gap-2" onClick={() => { setOpen(false); onRename(); }}><Icon name="edit" size={18} />Rename</button>
          <button className="w-full px-3 py-2 text-left text-body-md hover:bg-red-50 text-red-600 flex items-center gap-2" onClick={() => { setOpen(false); onDelete(); }}><Icon name="delete" size={18} />Delete</button>
        </div>
      )}
    </div>
  );
}

export default function ProjectBoard() {
  const { projectId } = useParams();
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const { socket, onlineIds } = useSocket();
  const toast = useToast();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [viewers, setViewers] = useState([]); // user ids currently looking at this board
  const [filters, setFilters] = useState({ q: '', assignee: '', priority: '', due: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [invite, setInvite] = useState(false);
  const [settings, setSettings] = useState(false);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumn, setNewColumn] = useState('');
  const filterRef = useRef(null);

  const isAdmin = project?.myRole === 'admin';
  const selectedId = params.get('task');
  const selectedTask = tasks.find((t) => t._id === selectedId);

  const loadProject = useCallback(() => api.get(`/projects/${projectId}`).then((r) => setProject(r.data)), [projectId]);
  const loadTasks = useCallback(() => api.get(`/projects/${projectId}/tasks`).then((r) => setTasks(r.data)), [projectId]);

  useEffect(() => {
    setStatus('loading');
    setFilters({ q: '', assignee: '', priority: '', due: '' });
    Promise.all([loadProject(), loadTasks()]).then(() => setStatus('ready')).catch(() => setStatus('error'));
  }, [projectId, loadProject, loadTasks]);

  // ---------------------------- real-time sync ----------------------------
  useEffect(() => {
    if (!socket) return undefined;
    const join = () => socket.emit('project:join', { projectId, presence: true }, (res) => res?.ok && setViewers(res.users));
    join();
    socket.on('connect', join); // re-join the room after a reconnect

    const bumpComments = (taskId, delta) => setTasks((p) => p.map((t) => (t._id === taskId ? { ...t, commentsCount: Math.max(0, (t.commentsCount || 0) + delta) } : t)));
    const handlers = {
      'presence:update': ({ projectId: id, users }) => id === projectId && setViewers(users),
      'task:created': (t) => setTasks((p) => (p.some((x) => x._id === t._id) ? p : [...p, t])),
      'task:updated': (t) => setTasks((p) => p.map((x) => (x._id === t._id ? { ...x, ...t } : x))),
      'task:moved': ({ task, columnOrders }) => setTasks((p) => applyOrders(p, task, columnOrders)),
      'task:deleted': ({ taskId }) => setTasks((p) => p.filter((x) => x._id !== taskId)),
      'project:updated': ({ projectId: id }) => id === projectId && loadProject().catch(() => {}),
      'comment:created': ({ taskId }) => bumpComments(taskId, 1),
      'comment:deleted': ({ taskId, removedIds }) => bumpComments(taskId, -removedIds.length),
    };
    Object.entries(handlers).forEach(([e, h]) => socket.on(e, h));
    return () => {
      socket.off('connect', join);
      Object.entries(handlers).forEach(([e, h]) => socket.off(e, h));
      socket.emit('project:leave', { projectId });
      setViewers([]);
    };
  }, [socket, projectId, loadProject]);

  // reload the column "project:updated" may also have changed the task list (column deleted etc.)
  useEffect(() => {
    if (!socket) return undefined;
    const reloadTasks = ({ projectId: id }) => id === projectId && loadTasks().catch(() => {});
    socket.on('project:updated', reloadTasks);
    return () => socket.off('project:updated', reloadTasks);
  }, [socket, projectId, loadTasks]);

  // close the modal if the open task disappeared (deleted by someone else)
  useEffect(() => {
    if (status === 'ready' && selectedId && !selectedTask) setParams({}, { replace: true });
  }, [status, selectedId, selectedTask, setParams]);

  useEffect(() => {
    const close = (e) => filterRef.current && !filterRef.current.contains(e.target) && setShowFilters(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  // ------------------------------ actions ------------------------------
  const moveTask = useCallback((taskId, columnId, index) => {
    const col = project.columns.find((c) => c._id === columnId);
    setTasks((prev) => {
      const moved = prev.find((t) => t._id === taskId);
      if (!moved) return prev;
      const destIds = colTasks(prev, columnId).map((t) => t._id).filter((id) => id !== taskId);
      const at = index === undefined ? destIds.length : index;
      destIds.splice(at, 0, taskId);
      const orders = { [columnId]: destIds };
      if (String(moved.column) !== columnId) orders[moved.column] = colTasks(prev, moved.column).map((t) => t._id).filter((id) => id !== taskId);
      return applyOrders(prev, { ...moved, isDone: !!col?.isDone }, orders);
    });
    api.put(`/tasks/${taskId}/move`, { columnId, index }).catch((e) => { toast(errMsg(e), 'error'); loadTasks(); });
  }, [project, toast, loadTasks]);

  const onDragEnd = ({ draggableId, source, destination }) => {
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    moveTask(draggableId, destination.droppableId, destination.index);
  };

  const addCard = async (columnId, title) => {
    try {
      const { data } = await api.post(`/projects/${projectId}/tasks`, { title, columnId });
      setTasks((p) => (p.some((x) => x._id === data._id) ? p : [...p, data])); // socket event may also deliver it; deduped
    } catch (e) { toast(errMsg(e), 'error'); }
  };

  const addColumn = async () => {
    if (!newColumn.trim()) return setAddingColumn(false);
    try { await api.post(`/projects/${projectId}/columns`, { name: newColumn }); setNewColumn(''); setAddingColumn(false); } catch (e) { toast(errMsg(e), 'error'); }
  };
  const renameColumn = async (col) => {
    const name = window.prompt('Rename column', col.name);
    if (name && name.trim() && name !== col.name) api.put(`/projects/${projectId}/columns/${col._id}`, { name }).catch((e) => toast(errMsg(e), 'error'));
  };
  const deleteColumn = (col) => {
    if (window.confirm(`Delete "${col.name}"? Its tasks will move to the first remaining column.`)) {
      api.delete(`/projects/${projectId}/columns/${col._id}`).catch((e) => toast(errMsg(e), 'error'));
    }
  };

  // ------------------------------ filtering ------------------------------
  const filtersActive = Object.values(filters).filter(Boolean).length;
  const matches = useCallback((t) => {
    if (filters.q && !t.title.toLowerCase().includes(filters.q.toLowerCase())) return false;
    if (filters.assignee === 'me' && !t.assignees.some((a) => a._id === user._id)) return false;
    if (filters.assignee === 'none' && t.assignees.length) return false;
    if (filters.assignee && !['me', 'none'].includes(filters.assignee) && !t.assignees.some((a) => a._id === filters.assignee)) return false;
    if (filters.priority && t.priority !== filters.priority) return false;
    if (filters.due) {
      if (!t.dueDate) return filters.due === 'none';
      const d = dayDiff(t.dueDate);
      if (filters.due === 'overdue' && !(d < 0 && !t.isDone)) return false;
      if (filters.due === 'today' && d !== 0) return false;
      if (filters.due === 'week' && !(d >= 0 && d <= 7)) return false;
      if (filters.due === 'none') return false;
    }
    return true;
  }, [filters, user._id]);

  const byColumn = useMemo(() => {
    const map = {};
    (project?.columns || []).forEach((c) => { map[c._id] = colTasks(tasks, c._id).filter(matches); });
    return map;
  }, [tasks, project, matches]);

  if (status === 'loading') return <Spinner className="py-24" />;
  if (status === 'error' || !project) return <NotFound />;

  const memberUsers = project.members.map((m) => m.user);
  const viewerUsers = memberUsers.filter((u) => viewers.includes(u._id));

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      {/* header */}
      <div className="bg-white/80 backdrop-blur-md px-4 sm:px-6 py-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0" style={{ background: project.color }}><Icon name={project.icon || 'web'} /></span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-headline-md truncate">{project.name}</h1>
                <span className="pill bg-surface-container-low text-on-surface-variant capitalize">{project.myRole}</span>
                {isAdmin && <button onClick={() => setSettings(true)} className="p-1 rounded hover:bg-surface-container text-slate-500" aria-label="Project settings"><Icon name="settings" size={18} /></button>}
              </div>
              <p className="text-body-sm text-on-surface-variant truncate max-w-xl">{project.description || 'No description'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800">
              <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600" /></span>
              <span className="text-label-sm font-medium">Live · {viewerUsers.length} active{viewerUsers.length > 0 && `: ${viewerUsers.slice(0, 3).map((u) => u.name.split(' ')[0]).join(', ')}${viewerUsers.length > 3 ? '…' : ''}`}</span>
            </div>
            <AvatarStack users={memberUsers} max={4} onlineIds={onlineIds} />
            {isAdmin && <button className="btn btn-outline btn-sm" onClick={() => setInvite(true)}><Icon name="person_add" size={18} /><span className="hidden sm:inline">Invite</span></button>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Icon name="search" className="absolute left-2.5 top-2 text-slate-400" size={18} />
            <input className="input !h-9 pl-9" placeholder="Search tasks…" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
          </div>
          <div className="relative" ref={filterRef}>
            <button onClick={() => setShowFilters(!showFilters)} className={cx('btn btn-sm', filtersActive ? 'bg-primary-fixed text-primary border border-primary/30' : 'btn-outline')}>
              <Icon name="filter_list" size={18} />Filter{filtersActive > 0 && <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] flex items-center justify-center">{filtersActive}</span>}
            </button>
            {showFilters && (
              <div className="pop-in absolute left-0 mt-2 w-72 card shadow-modal p-4 space-y-3 z-40">
                <div><label className="text-label-md block mb-1">Assignee</label>
                  <select className="input" value={filters.assignee} onChange={(e) => setFilters({ ...filters, assignee: e.target.value })}>
                    <option value="">Anyone</option><option value="me">Assigned to me</option><option value="none">Unassigned</option>
                    {memberUsers.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
                  </select></div>
                <div><label className="text-label-md block mb-1">Priority</label>
                  <select className="input" value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })}>
                    <option value="">Any</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
                  </select></div>
                <div><label className="text-label-md block mb-1">Due date</label>
                  <select className="input" value={filters.due} onChange={(e) => setFilters({ ...filters, due: e.target.value })}>
                    <option value="">Any time</option><option value="overdue">Overdue</option><option value="today">Due today</option><option value="week">Next 7 days</option><option value="none">No due date</option>
                  </select></div>
                <button className="btn btn-ghost btn-sm w-full" onClick={() => setFilters({ q: '', assignee: '', priority: '', due: '' })}>Clear filters</button>
              </div>
            )}
          </div>
          {filtersActive > 0 && <span className="text-body-sm text-slate-500 flex items-center gap-1"><Icon name="info" size={16} />Drag & drop is paused while filtering</span>}
        </div>
      </div>

      {/* board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex-1 flex gap-4 overflow-x-auto thin-scroll p-4 sm:p-6 items-start snap-x snap-mandatory sm:snap-none">
          {project.columns.map((col) => {
            const list = byColumn[col._id] || [];
            const total = colTasks(tasks, col._id).length;
            return (
              <div key={col._id} className="snap-center shrink-0 w-[85vw] sm:w-[300px] bg-surface-container-low/70 rounded-xl border border-slate-200/70 flex flex-col max-h-[calc(100vh-15rem)]">
                <div className="flex items-center justify-between px-3 pt-3 pb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: col.color }} />
                    <h3 className="text-label-lg uppercase tracking-wide truncate">{col.name}</h3>
                    <span className="pill bg-white border border-slate-200 text-slate-600">{filtersActive ? `${list.length}/${total}` : total}</span>
                  </div>
                  {isAdmin && <ColumnMenu column={col} onRename={() => renameColumn(col)} onDelete={() => deleteColumn(col)} />}
                </div>

                <Droppable droppableId={col._id} isDropDisabled={!!filtersActive}>
                  {(drop, snap) => (
                    <div ref={drop.innerRef} {...drop.droppableProps}
                      className={cx('flex-1 overflow-y-auto no-scrollbar px-2 pb-1 space-y-3 min-h-[60px] rounded-lg transition-colors', snap.isDraggingOver && 'bg-primary-fixed/60 outline-dashed outline-2 outline-primary/60 -outline-offset-2')}>
                      {list.map((task, i) => (
                        <Draggable key={task._id} draggableId={task._id} index={i} isDragDisabled={!!filtersActive}>
                          {(drag, ds) => (
                            <div ref={drag.innerRef} {...drag.draggableProps} {...drag.dragHandleProps} style={drag.draggableProps.style}>
                              <TaskCard task={task} dragging={ds.isDragging} onClick={() => setParams({ task: task._id })} />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {drop.placeholder}
                      {list.length === 0 && !snap.isDraggingOver && <p className="text-center text-body-sm text-slate-400 py-6">{filtersActive ? 'No matching tasks' : 'No tasks yet'}</p>}
                    </div>
                  )}
                </Droppable>

                <div className="p-2"><AddCard onAdd={(title) => addCard(col._id, title)} /></div>
              </div>
            );
          })}

          {isAdmin && (
            <div className="shrink-0 w-[85vw] sm:w-[300px]">
              {addingColumn ? (
                <div className="card p-3 space-y-2">
                  <input autoFocus className="input" placeholder="Column name" value={newColumn} onChange={(e) => setNewColumn(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addColumn()} maxLength={40} />
                  <div className="flex gap-2"><button className="btn btn-primary btn-sm" onClick={addColumn}>Add column</button><button className="btn btn-ghost btn-sm" onClick={() => setAddingColumn(false)}>Cancel</button></div>
                </div>
              ) : (
                <button onClick={() => setAddingColumn(true)} className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-primary hover:text-primary hover:bg-white transition text-body-md"><Icon name="add" />Add column</button>
              )}
            </div>
          )}
        </div>
      </DragDropContext>

      {selectedTask && (
        <TaskModal key={selectedTask._id} task={selectedTask} project={project} myRole={project.myRole}
          onClose={() => setParams({}, { replace: true })}
          onTaskChange={(t) => setTasks((p) => p.map((x) => (x._id === t._id ? { ...x, ...t } : x)))}
          onMove={(id, colId) => moveTask(id, colId)}
          onTaskRemoved={(id) => { setTasks((p) => p.filter((x) => x._id !== id)); setParams({}, { replace: true }); }} />
      )}
      {invite && <InviteModal project={project} onClose={() => setInvite(false)} onInvited={() => loadProject()} />}
      {settings && <ProjectSettingsModal project={project} isOwner={project.owner === user._id} onClose={() => setSettings(false)} onSaved={loadProject} />}
    </div>
  );
}
