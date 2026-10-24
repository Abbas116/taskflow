import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api, { errMsg } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useToast } from '../../context/ToastContext';
import { Avatar, Icon, Modal, ProgressBar, Spinner } from '../ui';
import { PRIORITIES, cx, timeAgo, toDateInput } from '../../utils/helpers';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Highlights "@Member Name" inside comment text
function CommentText({ text, members }) {
  const parts = useMemo(() => {
    const names = members.map((m) => escapeRegex(m.user.name)).sort((a, b) => b.length - a.length);
    if (!names.length) return [text];
    return text.split(new RegExp(`(@(?:${names.join('|')}))`, 'g'));
  }, [text, members]);
  return (
    <p className="text-body-md text-slate-800 whitespace-pre-wrap break-words">
      {parts.map((p, i) => (i % 2 === 1 ? <span key={i} className="text-primary font-medium bg-primary-fixed/60 rounded px-0.5">{p}</span> : p))}
    </p>
  );
}

function Label({ children }) {
  return <p className="text-label-sm uppercase tracking-wide text-slate-500 mb-1.5">{children}</p>;
}

export default function TaskModal({ task, project, myRole, onClose, onTaskChange, onMove, onTaskRemoved }) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const toast = useToast();
  const members = project.members;
  const memberUsers = members.map((m) => m.user);
  const canDelete = myRole === 'admin' || task.createdBy?._id === user._id;

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [comments, setComments] = useState(null);
  const [activity, setActivity] = useState([]);
  const [tab, setTab] = useState('comments');
  const [newSubtask, setNewSubtask] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [assigneeOpen, setAssigneeOpen] = useState(false);

  const [text, setText] = useState('');
  const [mentions, setMentions] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null); // { id, text }
  const [typing, setTyping] = useState({}); // userId -> name
  const typingTimers = useRef({});
  const iTyping = useRef(false);
  const stopTimer = useRef(null);
  const assigneeRef = useRef(null);

  useEffect(() => setTitle(task.title), [task.title]);
  useEffect(() => setDescription(task.description || ''), [task.description]);

  // initial load
  useEffect(() => {
    let alive = true;
    Promise.all([api.get(`/tasks/${task._id}/comments`), api.get(`/tasks/${task._id}/activity`)])
      .then(([c, a]) => { if (alive) { setComments(c.data); setActivity(a.data); } })
      .catch((e) => toast(errMsg(e), 'error'));
    return () => { alive = false; };
  }, [task._id]); // eslint-disable-line react-hooks/exhaustive-deps

  // real-time comments, activity and typing indicator
  useEffect(() => {
    if (!socket) return undefined;
    const onCreated = ({ taskId, comment }) => taskId === task._id && setComments((p) => (p && !p.some((c) => c._id === comment._id) ? [...p, comment] : p));
    const onUpdated = ({ taskId, comment }) => taskId === task._id && setComments((p) => p?.map((c) => (c._id === comment._id ? comment : c)));
    const onDeleted = ({ taskId, removedIds }) => taskId === task._id && setComments((p) => p?.filter((c) => !removedIds.includes(c._id)));
    const onActivity = (a) => a.task === task._id && setActivity((p) => (p.some((x) => x._id === a._id) ? p : [a, ...p]));
    const onTyping = ({ taskId, isTyping, user: u }) => {
      if (taskId !== task._id || u._id === user._id) return;
      clearTimeout(typingTimers.current[u._id]);
      setTyping((p) => { const n = { ...p }; isTyping ? (n[u._id] = u.name) : delete n[u._id]; return n; });
      if (isTyping) typingTimers.current[u._id] = setTimeout(() => setTyping((p) => { const n = { ...p }; delete n[u._id]; return n; }), 3500);
    };
    socket.on('comment:created', onCreated);
    socket.on('comment:updated', onUpdated);
    socket.on('comment:deleted', onDeleted);
    socket.on('activity:new', onActivity);
    socket.on('typing', onTyping);
    return () => {
      socket.off('comment:created', onCreated); socket.off('comment:updated', onUpdated); socket.off('comment:deleted', onDeleted);
      socket.off('activity:new', onActivity); socket.off('typing', onTyping);
      Object.values(typingTimers.current).forEach(clearTimeout);
    };
  }, [socket, task._id, user._id]);

  useEffect(() => {
    const close = (e) => assigneeRef.current && !assigneeRef.current.contains(e.target) && setAssigneeOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const save = useCallback(async (patch) => {
    try {
      const { data } = await api.put(`/tasks/${task._id}`, patch);
      onTaskChange(data);
    } catch (e) { toast(errMsg(e), 'error'); }
  }, [task._id, onTaskChange, toast]);

  /* ---------------------------- typing signal ---------------------------- */
  const emitTyping = (isTyping) => {
    if (iTyping.current === isTyping) return;
    iTyping.current = isTyping;
    socket?.emit('typing', { projectId: project._id, taskId: task._id, isTyping });
  };
  const onInput = (value) => {
    setText(value);
    if (value.trim()) {
      emitTyping(true);
      clearTimeout(stopTimer.current);
      stopTimer.current = setTimeout(() => emitTyping(false), 2000);
    } else emitTyping(false);
  };
  useEffect(() => () => { clearTimeout(stopTimer.current); if (iTyping.current) socket?.emit('typing', { projectId: project._id, taskId: task._id, isTyping: false }); }, []); // eslint-disable-line

  /* ------------------------------ comments ------------------------------ */
  const mentionMatch = text.match(/(?:^|\s)@([^\s@]*)$/);
  const suggestions = mentionMatch
    ? memberUsers.filter((m) => m._id !== user._id && m.name.toLowerCase().includes(mentionMatch[1].toLowerCase())).slice(0, 5)
    : [];

  const pickMention = (m) => {
    setText(text.replace(/@([^\s@]*)$/, `@${m.name} `));
    setMentions((p) => (p.includes(m._id) ? p : [...p, m._id]));
  };

  const startReply = (c) => {
    setReplyTo(c.parent ? comments.find((x) => x._id === c.parent) || c : c);
    if (c.author._id !== user._id) { setText(`@${c.author.name} `); setMentions([c.author._id]); }
    document.getElementById('comment-input')?.focus();
  };

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    const mentionIds = mentions.filter((id) => body.includes(`@${memberUsers.find((m) => m._id === id)?.name}`));
    try {
      await api.post(`/tasks/${task._id}/comments`, { text: body, mentions: mentionIds, parent: replyTo?._id || null });
      setText(''); setMentions([]); setReplyTo(null); emitTyping(false);
    } catch (e) { toast(errMsg(e), 'error'); }
  };

  const saveEdit = async () => {
    if (!editing.text.trim()) return;
    try { await api.put(`/comments/${editing.id}`, { text: editing.text }); setEditing(null); } catch (e) { toast(errMsg(e), 'error'); }
  };
  const removeComment = async (id) => {
    if (!window.confirm('Delete this comment?')) return;
    try { await api.delete(`/comments/${id}`); } catch (e) { toast(errMsg(e), 'error'); }
  };

  const roots = (comments || []).filter((c) => !c.parent);
  const repliesOf = (id) => (comments || []).filter((c) => c.parent === id);

  const renderComment = (c, reply = false) => {
    const mine = c.author._id === user._id;
    const isEditing = editing?.id === c._id;
    return (
      <div key={c._id} className={cx('flex gap-3', reply && 'ml-10 mt-3')}>
        <Avatar user={c.author} size={reply ? 'sm' : 'md'} ring={false} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-label-lg">{c.author.name}</span>
            <span className="text-body-sm text-slate-400">{timeAgo(c.createdAt)}{c.edited && ' · edited'}</span>
          </div>
          {isEditing ? (
            <div className="mt-1">
              <textarea className="textarea" rows={2} value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} autoFocus />
              <div className="flex gap-2 mt-2"><button className="btn btn-primary btn-sm" onClick={saveEdit}>Save</button><button className="btn btn-outline btn-sm" onClick={() => setEditing(null)}>Cancel</button></div>
            </div>
          ) : (
            <>
              <CommentText text={c.text} members={members} />
              <div className="flex gap-3 mt-1 text-label-md text-slate-500">
                <button className="hover:text-primary" onClick={() => startReply(c)}>Reply</button>
                {mine && <button className="hover:text-primary" onClick={() => setEditing({ id: c._id, text: c.text })}>Edit</button>}
                {(mine || myRole === 'admin') && <button className="hover:text-red-600" onClick={() => removeComment(c._id)}>Delete</button>}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  /* ------------------------------- subtasks ------------------------------- */
  const subtasks = task.subtasks || [];
  const doneCount = subtasks.filter((s) => s.done).length;
  const toggleSub = (id) => save({ subtasks: subtasks.map((s) => (s._id === id ? { ...s, done: !s.done } : s)) });
  const removeSub = (id) => save({ subtasks: subtasks.filter((s) => s._id !== id) });
  const addSub = () => { if (!newSubtask.trim()) return; save({ subtasks: [...subtasks, { title: newSubtask }] }); setNewSubtask(''); };

  const addLabel = () => {
    const l = newLabel.trim().replace(/,$/, '');
    if (l && !(task.labels || []).includes(l)) save({ labels: [...(task.labels || []), l] });
    setNewLabel('');
  };

  const assigneeIds = task.assignees.map((a) => a._id);
  const toggleAssignee = (id) => save({ assignees: assigneeIds.includes(id) ? assigneeIds.filter((x) => x !== id) : [...assigneeIds, id] });

  const remove = async () => {
    if (!window.confirm('Delete this task permanently?')) return;
    try { await api.delete(`/tasks/${task._id}`); onTaskRemoved(task._id); } catch (e) { toast(errMsg(e), 'error'); }
  };

  const typingNames = Object.values(typing);

  return (
    <Modal onClose={onClose} size="xl" fullOnMobile>
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 sticky top-0 bg-white z-10">
        <span className="pill bg-primary-fixed text-on-primary-fixed-variant"><span className="w-1.5 h-1.5 rounded-full" style={{ background: project.color }} />{project.name}</span>
        <div className="flex items-center gap-1">
          {canDelete && <button className="btn btn-ghost !h-8 !px-2 hover:!text-red-600 hover:!bg-red-50" onClick={remove} title="Delete task"><Icon name="delete" size={20} /></button>}
          <button className="btn btn-ghost !h-8 !w-8 !p-0" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px]">
        {/* main column */}
        <div className="p-5 sm:p-6 space-y-6 min-w-0">
          <input className="w-full text-headline-lg bg-transparent rounded-lg -mx-2 px-2 py-1 border border-transparent hover:border-slate-300 focus:border-primary outline-none"
            value={title} onChange={(e) => setTitle(e.target.value)}
            onBlur={() => { if (title.trim() && title !== task.title) save({ title }); else setTitle(task.title); }}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} aria-label="Task title" maxLength={200} />

          <div>
            <Label>Description</Label>
            <textarea className="textarea min-h-[110px]" placeholder="Add a more detailed description…" value={description}
              onChange={(e) => setDescription(e.target.value)} onBlur={() => description !== (task.description || '') && save({ description })} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5"><Label>Subtasks</Label>{subtasks.length > 0 && <span className="text-label-md text-slate-500">{doneCount}/{subtasks.length}</span>}</div>
            {subtasks.length > 0 && <ProgressBar value={(doneCount / subtasks.length) * 100} color="#10B981" className="mb-3" />}
            <ul className="space-y-1">
              {subtasks.map((s) => (
                <li key={s._id} className="group flex items-center gap-3 py-1">
                  <input type="checkbox" checked={s.done} onChange={() => toggleSub(s._id)} className="w-[18px] h-[18px] rounded accent-emerald-500 cursor-pointer" />
                  <span className={cx('flex-1 text-body-md', s.done && 'line-through text-slate-400')}>{s.title}</span>
                  <button className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500" onClick={() => removeSub(s._id)} aria-label="Remove subtask"><Icon name="close" size={16} /></button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2 mt-2">
              <input className="input" placeholder="Add a subtask" value={newSubtask} onChange={(e) => setNewSubtask(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSub()} />
              <button className="btn btn-outline btn-sm shrink-0" onClick={addSub} disabled={!newSubtask.trim()}>Add</button>
            </div>
          </div>

          <div>
            <div className="flex gap-1 border-b border-slate-200 mb-4">
              {[['comments', `Comments${comments ? ` (${comments.length})` : ''}`], ['activity', 'Activity']].map(([k, label]) => (
                <button key={k} onClick={() => setTab(k)} className={cx('px-3 py-2 text-label-lg border-b-2 -mb-px transition', tab === k ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800')}>{label}</button>
              ))}
            </div>

            {tab === 'comments' ? (
              <div className="space-y-5">
                {comments === null ? <Spinner className="!py-4" /> : roots.length === 0 ? (
                  <p className="text-body-md text-slate-500 text-center py-4">No comments yet. Start the conversation!</p>
                ) : roots.map((c) => (
                  <div key={c._id}>
                    {renderComment(c)}
                    {repliesOf(c._id).map((r) => renderComment(r, true))}
                  </div>
                ))}

                <div className="relative">
                  {replyTo && (
                    <div className="flex items-center justify-between text-body-sm bg-primary-fixed/50 rounded-t-lg px-3 py-1.5 text-on-primary-fixed-variant">
                      <span>Replying to <b>{replyTo.author.name}</b></span>
                      <button onClick={() => { setReplyTo(null); setText(''); setMentions([]); }} aria-label="Cancel reply"><Icon name="close" size={16} /></button>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <Avatar user={user} size="md" ring={false} className="mt-1" />
                    <div className="flex-1 min-w-0 relative">
                      <textarea id="comment-input" className="textarea pr-12" rows={2} placeholder="Write a comment… use @ to mention a teammate" value={text}
                        onChange={(e) => onInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
                      <button onClick={send} disabled={!text.trim()} className="absolute right-2 bottom-2 w-8 h-8 rounded-lg bg-[#6366F1] text-white flex items-center justify-center disabled:opacity-40 hover:bg-[#4F46E5]" aria-label="Send comment"><Icon name="send" size={16} /></button>
                      {suggestions.length > 0 && (
                        <div className="absolute z-20 bottom-full mb-1 left-0 w-64 card shadow-drag overflow-hidden">
                          {suggestions.map((m) => (
                            <button key={m._id} onMouseDown={(e) => { e.preventDefault(); pickMention(m); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-container-low text-left">
                              <Avatar user={m} size="xs" ring={false} /><span className="text-body-md">{m.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="h-5 mt-1 text-body-sm text-primary italic flex items-center gap-1.5">
                        {typingNames.length > 0 && (<><span className="flex gap-0.5"><i className="w-1 h-1 bg-primary rounded-full animate-bounce" /><i className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:120ms]" /><i className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:240ms]" /></span>
                          {typingNames.length === 1 ? `${typingNames[0]} is typing…` : `${typingNames.join(', ')} are typing…`}</>)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <ul className="space-y-3">
                {activity.length === 0 && <p className="text-body-md text-slate-500 text-center py-4">No activity yet.</p>}
                {activity.map((a) => (
                  <li key={a._id} className="flex items-start gap-3 text-body-md">
                    <Avatar user={a.actor} size="sm" ring={false} />
                    <p className="flex-1"><b>{a.actor?.name}</b> {a.text} <span className="text-slate-400 text-body-sm ml-1">{timeAgo(a.createdAt)}</span></p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* meta sidebar (shown first on mobile) */}
        <aside className="order-first lg:order-last border-b lg:border-b-0 lg:border-l border-slate-200 bg-surface-container-low/60 p-5 space-y-5">
          <div>
            <Label>Status</Label>
            <select className="input" value={task.column} onChange={(e) => onMove(task._id, e.target.value)}>
              {project.columns.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>

          <div ref={assigneeRef} className="relative">
            <Label>Assignees</Label>
            <button type="button" onClick={() => setAssigneeOpen(!assigneeOpen)} className="input flex items-center gap-2 text-left !h-auto min-h-[38px] py-1.5">
              {task.assignees.length === 0 ? <span className="text-slate-400">Unassigned</span> : (
                <span className="flex flex-wrap gap-1.5 flex-1">{task.assignees.map((a) => <span key={a._id} className="inline-flex items-center gap-1 text-body-sm"><Avatar user={a} size="xs" ring={false} />{a.name.split(' ')[0]}</span>)}</span>
              )}
              <Icon name="expand_more" className="text-slate-400 ml-auto" size={18} />
            </button>
            {assigneeOpen && (
              <div className="absolute z-20 mt-1 w-full card shadow-drag max-h-60 overflow-y-auto">
                {memberUsers.map((m) => (
                  <label key={m._id} className="flex items-center gap-2 px-3 py-2 hover:bg-surface-container-low cursor-pointer">
                    <input type="checkbox" className="accent-[#6366F1]" checked={assigneeIds.includes(m._id)} onChange={() => toggleAssignee(m._id)} />
                    <Avatar user={m} size="xs" ring={false} /><span className="text-body-md truncate">{m.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label>Due date</Label>
            <div className="flex gap-2">
              <input type="date" className="input" value={toDateInput(task.dueDate)} onChange={(e) => save({ dueDate: e.target.value || null })} />
              {task.dueDate && <button className="btn btn-ghost btn-sm !px-2" onClick={() => save({ dueDate: null })} aria-label="Clear due date"><Icon name="close" size={18} /></button>}
            </div>
          </div>

          <div>
            <Label>Priority</Label>
            <select className="input" value={task.priority} onChange={(e) => save({ priority: e.target.value })}>
              {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>

          <div>
            <Label>Labels</Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(task.labels || []).map((l) => (
                <span key={l} className="pill bg-primary-fixed text-on-primary-fixed-variant">{l}
                  <button onClick={() => save({ labels: task.labels.filter((x) => x !== l) })} aria-label={`Remove ${l}`}><Icon name="close" size={12} /></button></span>
              ))}
            </div>
            <input className="input" placeholder="Add label + Enter" value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addLabel(); } }} maxLength={30} />
          </div>

          <p className="text-body-sm text-slate-500 pt-2 border-t border-slate-200">
            Created by <b className="text-slate-700">{task.createdBy?.name || 'Unknown'}</b><br />{new Date(task.createdAt).toLocaleString()}
          </p>
        </aside>
      </div>
    </Modal>
  );
}
