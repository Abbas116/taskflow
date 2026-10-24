import { useState } from 'react';
import api, { errMsg } from '../api/client';
import { useToast } from '../context/ToastContext';
import { Avatar, ErrorText, Modal } from './ui';
import UserSearchPicker from './UserSearchPicker';

// Add an existing TaskFlow user to a project (by search, or by typing an exact email)
export default function InviteModal({ project, onClose, onInvited }) {
  const toast = useToast();
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const memberIds = project.members.map((m) => m.user._id);

  const invite = async (payload) => {
    setError('');
    try {
      const { data } = await api.post(`/projects/${project._id}/members`, payload);
      toast('Member added to the project', 'success');
      onInvited?.(data);
    } catch (err) {
      setError(errMsg(err));
    }
  };

  return (
    <Modal onClose={onClose} title={`Invite to ${project.name}`} size="md">
      <div className="p-5 space-y-5">
        <ErrorText>{error}</ErrorText>
        <div>
          <label className="text-label-md text-slate-700 block mb-1">Search people</label>
          <UserSearchPicker exclude={memberIds} onPick={(u) => invite({ userId: u._id })} />
        </div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (email.trim()) { invite({ email }); setEmail(''); } }}>
          <input className="input" type="email" placeholder="…or enter an exact email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn btn-primary btn-sm shrink-0" disabled={!email.trim()}>Add</button>
        </form>
        <div>
          <p className="text-label-md text-slate-500 mb-2">Current members ({project.members.length})</p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {project.members.map((m) => (
              <div key={m.user._id} className="flex items-center gap-3">
                <Avatar user={m.user} size="sm" ring={false} />
                <span className="text-body-md flex-1 truncate">{m.user.name}</span>
                <span className="pill bg-surface-container text-on-surface-variant capitalize">{m.role}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
