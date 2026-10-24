import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { Icon } from './ui';

export default function GlobalSearch() {
  const [q, setQ] = useState('');
  const [res, setRes] = useState({ projects: [], tasks: [] });
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const input = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (q.trim().length < 2) { setRes({ projects: [], tasks: [] }); return undefined; }
    const t = setTimeout(() => api.get('/search', { params: { q } }).then((r) => setRes(r.data)).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const shortcut = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); input.current?.focus(); } };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', shortcut);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', shortcut); };
  }, []);

  const go = (path) => { setOpen(false); setQ(''); navigate(path); };
  const empty = !res.projects.length && !res.tasks.length;

  return (
    <div className="relative flex-1 max-w-lg" ref={ref}>
      <Icon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" size={20} />
      <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        placeholder="Search tasks, projects…"
        className="w-full pl-9 pr-12 h-9 rounded-lg bg-surface-container-low text-body-sm placeholder:text-on-surface-variant outline-none focus:bg-white focus:ring-[3px] focus:ring-[#6366F1]/15 shadow-sm transition" />
      <kbd className="hidden md:block absolute right-2 top-1/2 -translate-y-1/2 text-label-sm text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded">⌘K</kbd>
      {open && q.trim().length >= 2 && (
        <div className="pop-in absolute left-0 right-0 mt-2 card shadow-modal max-h-96 overflow-y-auto z-50">
          {empty ? <p className="p-4 text-body-md text-slate-500">No results for “{q}”</p> : (
            <>
              {res.projects.length > 0 && <p className="px-4 pt-3 pb-1 text-label-sm uppercase text-slate-400">Projects</p>}
              {res.projects.map((p) => (
                <button key={p._id} onClick={() => go(`/projects/${p._id}`)} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-surface-container-low text-left">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} /><span className="text-body-md">{p.name}</span>
                </button>
              ))}
              {res.tasks.length > 0 && <p className="px-4 pt-3 pb-1 text-label-sm uppercase text-slate-400">Tasks</p>}
              {res.tasks.map((t) => (
                <button key={t._id} onClick={() => go(`/projects/${t.project}?task=${t._id}`)} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-surface-container-low text-left">
                  <Icon name={t.isDone ? 'check_circle' : 'radio_button_unchecked'} size={18} className={t.isDone ? 'text-emerald-500' : 'text-slate-400'} />
                  <span className="min-w-0"><span className="block text-body-md truncate">{t.title}</span><span className="block text-body-sm text-slate-500">{t.projectName}</span></span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
