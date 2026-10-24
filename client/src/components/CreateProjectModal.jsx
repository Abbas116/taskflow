import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api/client';
import { useProjects } from '../context/ProjectsContext';
import { useToast } from '../context/ToastContext';
import { Avatar, ErrorText, Icon, Modal } from './ui';
import UserSearchPicker from './UserSearchPicker';
import { PROJECT_COLORS, PROJECT_ICONS, cx } from '../utils/helpers';

export default function CreateProjectModal({ onClose }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { refresh } = useProjects();
  const [form, setForm] = useState({ name: '', description: '', color: PROJECT_COLORS[0], icon: PROJECT_ICONS[0] });
  const [members, setMembers] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const { data } = await api.post('/projects', { ...form, memberIds: members.map((m) => m._id) });
      await refresh();
      toast(`Project "${data.name}" created`, 'success');
      onClose();
      navigate(`/projects/${data._id}`);
    } catch (err) {
      setError(errMsg(err));
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} title="Create new project" size="lg"
      footer={<>
        <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
        <button form="create-project" className="btn btn-primary" disabled={saving || !form.name.trim()}>{saving ? 'Creating…' : 'Create project'}</button>
      </>}>
      <form id="create-project" onSubmit={submit} className="p-5 space-y-4">
        <ErrorText>{error}</ErrorText>
        <div>
          <label className="text-label-md text-slate-700 block mb-1">Project name</label>
          <input className="input" autoFocus placeholder="e.g. Website Redesign" value={form.name} onChange={set('name')} maxLength={80} />
        </div>
        <div>
          <label className="text-label-md text-slate-700 block mb-1">Description</label>
          <textarea className="textarea" rows={3} placeholder="What is this project about?" value={form.description} onChange={set('description')} maxLength={500} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-label-md text-slate-700 block mb-2">Color</label>
            <div className="flex flex-wrap gap-2">
              {PROJECT_COLORS.map((c) => (
                <button type="button" key={c} onClick={() => setForm({ ...form, color: c })} aria-label={c}
                  className={cx('w-7 h-7 rounded-full ring-offset-2 transition', form.color === c && 'ring-2 ring-slate-900')} style={{ background: c }} />
              ))}
            </div>
          </div>
          <div>
            <label className="text-label-md text-slate-700 block mb-2">Icon</label>
            <div className="flex flex-wrap gap-1.5">
              {PROJECT_ICONS.map((i) => (
                <button type="button" key={i} onClick={() => setForm({ ...form, icon: i })}
                  className={cx('w-8 h-8 rounded-lg flex items-center justify-center border transition', form.icon === i ? 'bg-primary-fixed border-primary text-primary' : 'border-slate-200 text-slate-500 hover:bg-slate-50')}>
                  <Icon name={i} size={18} />
                </button>
              ))}
            </div>
          </div>
        </div>
        <div>
          <label className="text-label-md text-slate-700 block mb-1">Invite members</label>
          <UserSearchPicker exclude={members.map((m) => m._id)} onPick={(u) => setMembers([...members, u])} />
          {members.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {members.map((m) => (
                <span key={m._id} className="inline-flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full bg-primary-fixed text-on-primary-fixed-variant text-label-md">
                  <Avatar user={m} size="xs" ring={false} /> {m.name}
                  <button type="button" onClick={() => setMembers(members.filter((x) => x._id !== m._id))} aria-label={`Remove ${m.name}`}><Icon name="close" size={14} /></button>
                </span>
              ))}
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}
