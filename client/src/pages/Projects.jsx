import { Link } from 'react-router-dom';
import { useProjects } from '../context/ProjectsContext';
import { useUI } from '../context/UIContext';
import { AvatarStack, EmptyState, Icon, ProgressBar, Spinner } from '../components/ui';

export function ProjectCard({ p }) {
  const pct = p.taskCount ? Math.round((p.doneCount / p.taskCount) * 100) : 0;
  return (
    <Link to={`/projects/${p._id}`} className="card p-4 hover:shadow-card-hover hover:border-slate-300 transition block">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: p.color }}><Icon name={p.icon || 'web'} /></span>
        <div className="min-w-0">
          <h3 className="text-headline-sm truncate">{p.name}</h3>
          <p className="text-body-sm text-on-surface-variant truncate">{p.description || 'No description'}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between text-label-md text-on-surface-variant"><span>Progress</span><span className="font-semibold text-on-surface">{pct}%</span></div>
      <ProgressBar value={pct} color={p.color} className="mt-1.5" />
      <div className="mt-4 flex items-center justify-between">
        <span className="flex items-center gap-1 text-body-sm text-on-surface-variant"><Icon name="task_alt" size={16} />{p.taskCount} tasks</span>
        <AvatarStack users={p.members.map((m) => m.user)} max={3} size="sm" />
      </div>
    </Link>
  );
}

export default function Projects() {
  const { projects, loading } = useProjects();
  const { openCreateProject } = useUI();
  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-headline-lg">Projects</h1>
          <p className="text-body-md text-on-surface-variant">All the projects you're part of.</p>
        </div>
        <button className="btn btn-primary" onClick={openCreateProject}><Icon name="add" size={18} />New Project</button>
      </div>
      {loading ? <Spinner /> : projects.length === 0 ? (
        <div className="card"><EmptyState icon="folder_open" title="No projects yet" text="Create your first project to start organizing tasks with your team."
          action={<button className="btn btn-primary" onClick={openCreateProject}>Create project</button>} /></div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">{projects.map((p) => <ProjectCard key={p._id} p={p} />)}</div>
      )}
    </div>
  );
}
