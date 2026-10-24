import { useEffect, useRef, useState } from 'react';
import api from '../api/client';
import { Avatar, Icon } from './ui';

// Type 2+ characters -> debounced search by name / email. Calls onPick(user).
export default function UserSearchPicker({ onPick, exclude = [], placeholder = 'Search people by name or email' }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return undefined; }
    const t = setTimeout(() => {
      api.get('/users/search', { params: { q } }).then((r) => setResults(r.data)).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const close = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const visible = results.filter((u) => !exclude.includes(u._id));

  return (
    <div className="relative" ref={box}>
      <Icon name="search" className="absolute left-3 top-2.5 text-slate-400" size={18} />
      <input className="input pl-9" value={q} placeholder={placeholder}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} />
      {open && q.trim().length >= 2 && (
        <div className="absolute z-20 mt-1 w-full card shadow-drag max-h-60 overflow-y-auto">
          {visible.length === 0 ? (
            <p className="p-3 text-body-sm text-slate-500">No matching users found</p>
          ) : visible.map((u) => (
            <button type="button" key={u._id} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-surface-container-low text-left"
              onClick={() => { onPick(u); setQ(''); setResults([]); setOpen(false); }}>
              <Avatar user={u} size="sm" ring={false} />
              <span className="min-w-0">
                <span className="block text-body-md text-slate-900 truncate">{u.name}</span>
                <span className="block text-body-sm text-slate-500 truncate">{u.email}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
