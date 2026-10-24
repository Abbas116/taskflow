import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useProjects } from '../context/ProjectsContext';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import { useUI } from '../context/UIContext';
import api, { errMsg } from '../api/client';
import { Avatar, EmptyState, Icon, Spinner } from '../components/ui';
import InviteModal from '../components/InviteModal';
import { cx } from '../utils/helpers';

export default function Team() {
  const { user } = useAuth();
  const { projects, loading, refresh } = useProjects();
  const { onlineIds, socket } = useSocket();
  const { openCreateProject } = useUI();
  const toast = useToast();
  const [projectId, setProjectId] = useState('');
  const [project, setProject] = useState(null);
  const [invite, setInvite] = useState(false);

  useEffect(() => { if (!projectId && projects.length) setProjectId(projects[0]._id); }, [projects, projectId]);

  const load = () => projectId && api.get(`/projects/${projectId}`).then((r) => setProject(r.data)).catch(() => setProject(null));
  useEffect(() => { setProject(null); load(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // keep the list live when members change while this page is open
  useEffect(() => {
    if (!socket || !projectId) return undefined;
    const join = () => socket.emit('project:join', { projectId, presence: false });
    join();
    socket.on('connect', join);
    const h = ({ projectId: id }) => id === projectId && load();
    socket.on('project:updated', h);
    return () => { socket.off('connect', join); socket.off('project:updated', h); socket.emit('project:leave', { projectId }); };
  }, [socket, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <Spinner className="py-24" />;
  if (!projects.length) return <div className="p-6 max-w-3xl mx-auto card mt-6"><EmptyState icon="group" title="No team yet" text="Create a project, then invite people to collaborate." action={<button className="btn btn-primary" onClick={openCreateProject}>Create project</button>} /></div>;

  const isAdmin = project?.myRole === 'admin';
  const changeRole = async (userId, role) => {
    try { setProject((await api.put(`/projects/${projectId}/members/${userId}`, { role })).data); } catch (e) { toast(errMsg(e), 'error'); }
  };
  const remove = async (m) => {
    const self = m.user._id === user._id;
    if (!window.confirm(self ? `Leave "${project.name}"?` : `Remove ${m.user.name} from the project?`)) return;
    try {
      await api.delete(`/projects/${projectId}/members/${m.user._id}`);
      if (self) { await refresh(); setProjectId(''); } else load();
      toast(self ? 'You left the project' : 'Member removed', 'success');
    } catch (e) { toast(errMsg(e), 'error'); }
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div><h1 className="text-headline-lg">Team / Members</h1><p className="text-body-md text-on-surface-variant">Manage who can access each project.</p></div>
        <div className="flex gap-2">
          <select className="input !w-auto" value={projectId} onChange={(e) => setProjectId(e.target.value)}>{projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select>
          {isAdmin && <button className="btn btn-primary" onClick={() => setInvite(true)}><Icon name="person_add" size={18} />Invite</button>}
        </div>
      </div>

      {!project ? <Spinner /> : (
        <div className="card divide-y divide-slate-100">
          {project.members.map((m) => {
            const isOwner = project.owner === m.user._id;
            const self = m.user._id === user._id;
            const online = onlineIds.has(m.user._id);
            return (
              <div key={m.user._id} className="flex flex-wrap items-center gap-3 p-4">
                <Avatar user={m.user} size="lg" online={online} />
                <div className="min-w-0 flex-1">
                  <p className="text-label-lg truncate">{m.user.name}{self && <span className="text-slate-400 font-normal"> (you)</span>}</p>
                  <p className="text-body-sm text-slate-500 truncate">{m.user.email}{m.user.title && ` · ${m.user.title}`}</p>
                </div>
                <span className={cx('text-label-md', online ? 'text-emerald-600' : 'text-slate-400')}>{online ? 'Online' : 'Offline'}</span>
                {isAdmin && !isOwner ? (
                  <select className="input !w-auto !h-8 text-label-md" value={m.role} onChange={(e) => changeRole(m.user._id, e.target.value)}><option value="admin">Admin</option><option value="member">Member</option></select>
                ) : (
                  <span className={cx('pill', m.role === 'admin' ? 'bg-primary-fixed text-primary' : 'bg-surface-container text-on-surface-variant')}>{isOwner ? 'Owner' : m.role === 'admin' ? 'Admin' : 'Member'}</span>
                )}
                {!isOwner && (isAdmin || self) && (
                  <button className="btn btn-ghost !h-8 !px-2 hover:!text-red-600 hover:!bg-red-50" onClick={() => remove(m)} title={self ? 'Leave project' : 'Remove member'}><Icon name={self ? 'logout' : 'person_remove'} size={18} /></button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {invite && project && <InviteModal project={project} onClose={() => setInvite(false)} onInvited={() => load()} />}
    </div>
  );
}
