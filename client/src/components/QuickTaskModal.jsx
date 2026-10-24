import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api/client';
import { useProjects } from '../context/ProjectsContext';
import { useToast } from '../context/ToastContext';
import { ErrorText, Modal } from './ui';

// "New Task" button in the top bar: pick a project, type a title, task lands in its first column
export default function QuickTaskModal({ onClose, defaultProjectId }) {
  const { projects } = useProjects();
  const toast = useToast();
  const navigate = useNavigate();
  const [projectId, setProjectId] = useState(defaultProjectId || projects[0]?._id || '');
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('medium');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post(`/projects/${projectId}/tasks`, { title, priority });
      toast('Task created', 'success');
      onClose();
      navigate(`/projects/${projectId}?task=${data._id}`);
    } catch (err) {
      setError(errMsg(err));
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} title="New task" size="md"
      footer={<>
        <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
        <button form="quick-task" className="btn btn-primary" disabled={saving || !title.trim() || !projectId}>Create task</button>
      </>}>
      <form id="quick-task" onSubmit={submit} className="p-5 space-y-4">
        {projects.length === 0 && <ErrorText>Create a project first, then you can add tasks to it.</ErrorText>}
        <ErrorText>{error}</ErrorText>
        <div>
          <label className="text-label-md text-slate-700 block mb-1">Project</label>
          <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-label-md text-slate-700 block mb-1">Task title</label>
          <input className="input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to be done?" maxLength={200} />
        </div>
        <div>
          <label className="text-label-md text-slate-700 block mb-1">Priority</label>
          <select className="input" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
          </select>
        </div>
      </form>
    </Modal>
  );
}
