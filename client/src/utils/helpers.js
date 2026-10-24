export const initials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';

const AVATAR_COLORS = [
  'bg-primary-fixed text-on-primary-fixed-variant',
  'bg-secondary-fixed text-on-secondary-fixed-variant',
  'bg-tertiary-fixed text-on-tertiary-fixed-variant',
  'bg-emerald-100 text-emerald-800',
  'bg-amber-100 text-amber-800',
  'bg-sky-100 text-sky-800',
];
export const avatarColor = (seed = '') => {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};

export const PRIORITIES = {
  low: { label: 'Low', dot: 'bg-slate-400', pill: 'bg-slate-100 text-slate-600' },
  medium: { label: 'Medium', dot: 'bg-amber-500', pill: 'bg-amber-50 text-amber-700' },
  high: { label: 'High', dot: 'bg-red-500', pill: 'bg-red-50 text-red-600' },
  urgent: { label: 'Urgent', dot: 'bg-white', pill: 'bg-red-500 text-white' },
};

export const PROJECT_COLORS = ['#6366F1', '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#14B8A6'];
export const PROJECT_ICONS = ['web', 'smartphone', 'rocket_launch', 'campaign', 'palette', 'code', 'bar_chart', 'shopping_bag', 'school', 'science'];

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const dayDiff = (date) => Math.round((startOfDay(date) - startOfDay(new Date())) / 864e5);

export const formatDue = (date) => {
  if (!date) return '';
  const diff = dayDiff(date);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
export const isOverdue = (task) => !!task.dueDate && !task.isDone && dayDiff(task.dueDate) < 0;
export const toDateInput = (date) => (date ? new Date(date).toISOString().slice(0, 10) : '');

export const timeAgo = (date) => {
  const s = Math.max(1, Math.floor((Date.now() - new Date(date)) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const NOTIF_META = {
  task_assigned: { icon: 'assignment_ind', color: 'bg-primary-fixed text-primary' },
  comment: { icon: 'chat_bubble', color: 'bg-sky-100 text-sky-700' },
  mention: { icon: 'alternate_email', color: 'bg-tertiary-fixed text-tertiary' },
  due_soon: { icon: 'alarm', color: 'bg-amber-100 text-amber-700' },
  status_changed: { icon: 'swap_horiz', color: 'bg-emerald-100 text-emerald-700' },
  project_invite: { icon: 'group_add', color: 'bg-secondary-fixed text-secondary' },
};

// Resize an image file to a small square data URL so we can store avatars without a file server
export const fileToAvatar = (file, size = 160) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const s = Math.min(img.width, img.height);
      canvas.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = reject;
    img.src = url;
  });

export const cx = (...c) => c.filter(Boolean).join(' ');
