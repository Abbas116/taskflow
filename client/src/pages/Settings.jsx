import { useRef, useState } from 'react';
import api, { errMsg } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Avatar, ErrorText, Toggle } from '../components/ui';
import { fileToAvatar } from '../utils/helpers';

const PREFS = [
  ['assigned', 'Task assigned to me', 'When someone assigns you a task'],
  ['comments', 'New comments', 'Comments on tasks you created or are assigned to'],
  ['mentions', 'Mentions', 'When someone @mentions you'],
  ['statusChanged', 'Status changes', 'When a task you follow moves to another column'],
  ['dueSoon', 'Due soon reminders', 'Tasks due within 24 hours'],
  ['invites', 'Project invites', 'When you are added to a project'],
];

export default function Settings() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const fileRef = useRef(null);
  const [profile, setProfile] = useState({ name: user.name, title: user.title || '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwError, setPwError] = useState('');

  const saveProfile = async (e) => {
    e.preventDefault();
    try { const { data } = await api.put('/auth/me', profile); setUser(data.user); toast('Profile saved', 'success'); } catch (err) { toast(errMsg(err), 'error'); }
  };
  const uploadAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { const { data } = await api.put('/auth/me', { avatar: await fileToAvatar(file) }); setUser(data.user); toast('Avatar updated', 'success'); } catch (err) { toast(errMsg(err), 'error'); }
  };
  const removeAvatar = async () => { const { data } = await api.put('/auth/me', { avatar: '' }); setUser(data.user); };
  const togglePref = async (key, value) => {
    setUser({ ...user, notificationPrefs: { ...user.notificationPrefs, [key]: value } });
    try { await api.put('/auth/me', { notificationPrefs: { [key]: value } }); } catch (err) { toast(errMsg(err), 'error'); }
  };
  const changePassword = async (e) => {
    e.preventDefault();
    setPwError('');
    if (pw.newPassword !== pw.confirm) return setPwError('New passwords do not match');
    try { await api.put('/auth/password', pw); setPw({ currentPassword: '', newPassword: '', confirm: '' }); toast('Password changed', 'success'); } catch (err) { setPwError(errMsg(err)); }
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div><h1 className="text-headline-lg">Settings</h1><p className="text-body-md text-on-surface-variant">Manage your profile, password and notifications.</p></div>

      <form onSubmit={saveProfile} className="card p-5 space-y-4">
        <h2 className="text-headline-sm">Profile</h2>
        <div className="flex items-center gap-4">
          <Avatar user={user} size="xl" ring={false} />
          <div className="flex gap-2 flex-wrap">
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={uploadAvatar} />
            <button type="button" className="btn btn-outline btn-sm" onClick={() => fileRef.current.click()}>Upload photo</button>
            {user.avatar && <button type="button" className="btn btn-ghost btn-sm" onClick={removeAvatar}>Remove</button>}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className="text-label-md block mb-1">Full name</label><input className="input" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} required /></div>
          <div><label className="text-label-md block mb-1">Job title</label><input className="input" value={profile.title} onChange={(e) => setProfile({ ...profile, title: e.target.value })} placeholder="e.g. Product Lead" /></div>
          <div className="sm:col-span-2"><label className="text-label-md block mb-1">Email</label><input className="input bg-slate-50" value={user.email} disabled /></div>
        </div>
        <button className="btn btn-primary">Save profile</button>
      </form>

      <form onSubmit={changePassword} className="card p-5 space-y-4">
        <h2 className="text-headline-sm">Change password</h2>
        <ErrorText>{pwError}</ErrorText>
        <div className="grid sm:grid-cols-3 gap-4">
          <input className="input" type="password" placeholder="Current password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required autoComplete="current-password" />
          <input className="input" type="password" placeholder="New password" minLength={6} value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required autoComplete="new-password" />
          <input className="input" type="password" placeholder="Confirm new password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required autoComplete="new-password" />
        </div>
        <button className="btn btn-outline">Update password</button>
      </form>

      <section className="card p-5">
        <h2 className="text-headline-sm mb-1">Notification preferences</h2>
        <p className="text-body-sm text-on-surface-variant mb-3">Choose which events create a notification for you.</p>
        <div className="divide-y divide-slate-100">
          {PREFS.map(([key, title, desc]) => (
            <div key={key} className="flex items-center justify-between gap-4 py-3">
              <div><p className="text-body-md font-medium">{title}</p><p className="text-body-sm text-slate-500">{desc}</p></div>
              <Toggle checked={user.notificationPrefs?.[key] !== false} onChange={(v) => togglePref(key, v)} label={title} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
