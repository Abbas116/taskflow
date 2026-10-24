import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errMsg } from '../../api/client';
import { useProjects } from '../../context/ProjectsContext';
import { useToast } from '../../context/ToastContext';
import { ErrorText, Icon, Modal } from '../ui';
import { PROJECT_COLORS, PROJECT_ICONS, cx } from '../../utils/helpers';

export default function ProjectSettingsModal({ project, isOwner, onClose, onSaved }) {
  const { refresh } = useProjects();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: project.name, description: project.description || '', color: project.color, icon: project.icon });
  const [error, setError] = useState('');

  const save = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/projects/${project._id}`, form);
      await refresh();
      toast('Project updated', 'success');
      onSaved();
      onClose();
    } catch (err) { setError(errMsg(err)); }
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${project.name}" and all of its tasks? This cannot be undone.`)) return;
    try {
      await api.delete(`/projects/${project._id}`);
      await refresh();
      toast('Project deleted', 'success');
      navigate('/projects');
    } catch (err) { setError(errMsg(err)); }
  };

  return (
    <Modal onClose={onClose} title="Project settings" size="md"
      footer={<>
        {isOwner && <button type="button" className="btn btn-danger mr-auto" onClick={remove}><Icon name="delete" size={18} />Delete</button>}
        <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
        <button form="project-settings" className="btn btn-primary" disabled={!form.name.trim()}>Save</button>
      </>}>
      <form id="project-settings" onSubmit={save} className="p-5 space-y-4">
        <ErrorText>{error}</ErrorText>
        <div><label className="text-label-md block mb-1">Name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><label className="text-label-md block mb-1">Description</label><textarea className="textarea" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div className="flex flex-wrap gap-2">
          {PROJECT_COLORS.map((c) => <button type="button" key={c} onClick={() => setForm({ ...form, color: c })} className={cx('w-7 h-7 rounded-full ring-offset-2', form.color === c && 'ring-2 ring-slate-900')} style={{ background: c }} aria-label={c} />)}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PROJECT_ICONS.map((i) => (
            <button type="button" key={i} onClick={() => setForm({ ...form, icon: i })} className={cx('w-8 h-8 rounded-lg flex items-center justify-center border', form.icon === i ? 'bg-primary-fixed border-primary text-primary' : 'border-slate-200 text-slate-500')}><Icon name={i} size={18} /></button>
          ))}
        </div>
      </form>
    </Modal>
  );
}
