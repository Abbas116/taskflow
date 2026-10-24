import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { errMsg } from '../api/client';
import { ErrorText, Icon } from '../components/ui';
import { cx } from '../utils/helpers';

export default function AuthPage() {
  const { user, login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [remember, setRemember] = useState(true);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const isLogin = mode === 'login';

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!isLogin && form.password !== form.confirm) return setError('Passwords do not match');
    setBusy(true);
    try {
      if (isLogin) await login(form.email, form.password, remember);
      else await register(form.name, form.email, form.password);
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center lg:p-4">
      <div className="w-full max-w-6xl lg:min-h-[720px] bg-white lg:rounded-2xl shadow-modal overflow-hidden grid lg:grid-cols-2">
        {/* form side */}
        <div className="p-6 sm:p-10 flex flex-col">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center"><Icon name="view_kanban" filled /></span>
            <div>
              <p className="text-headline-sm leading-tight">TaskFlow</p>
              <p className="text-label-sm text-on-surface-variant uppercase tracking-wide">Fluid project collaboration</p>
            </div>
          </div>

          <div className="flex-1 flex items-center">
            <div className="w-full max-w-md mx-auto py-8">
              <div className="grid grid-cols-2 p-1 rounded-xl bg-surface-container-low mb-8">
                {[['login', 'Sign In'], ['register', 'Create Account']].map(([m, label]) => (
                  <button key={m} type="button" onClick={() => { setMode(m); setError(''); }}
                    className={cx('py-2 rounded-lg text-label-lg transition', mode === m ? 'bg-white shadow-sm text-on-surface' : 'text-on-surface-variant')}>{label}</button>
                ))}
              </div>

              <h1 className="text-headline-lg">{isLogin ? 'Welcome back' : 'Create your account'}</h1>
              <p className="text-body-md text-on-surface-variant mt-1 mb-6">
                {isLogin ? 'Enter your credentials to access your workspace and team projects.' : 'Start collaborating with your team in seconds.'}
              </p>

              <form onSubmit={submit} className="space-y-4">
                <ErrorText>{error}</ErrorText>
                {!isLogin && (
                  <div>
                    <label className="text-label-md block mb-1">Full name</label>
                    <input className="input" required value={form.name} onChange={set('name')} placeholder="Alex Morgan" />
                  </div>
                )}
                <div>
                  <label className="text-label-md block mb-1">Work email</label>
                  <div className="relative">
                    <Icon name="mail" className="absolute left-3 top-2.5 text-slate-400" size={18} />
                    <input className="input pl-10" type="email" required value={form.email} onChange={set('email')} placeholder="you@company.com" autoComplete="email" />
                  </div>
                </div>
                <div>
                  <label className="text-label-md block mb-1">Password</label>
                  <div className="relative">
                    <Icon name="lock" className="absolute left-3 top-2.5 text-slate-400" size={18} />
                    <input className="input pl-10 pr-10" type={showPw ? 'text' : 'password'} required minLength={6} value={form.password} onChange={set('password')}
                      placeholder="At least 6 characters" autoComplete={isLogin ? 'current-password' : 'new-password'} />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600" aria-label="Toggle password visibility">
                      <Icon name={showPw ? 'visibility_off' : 'visibility'} size={18} />
                    </button>
                  </div>
                </div>
                {!isLogin && (
                  <div>
                    <label className="text-label-md block mb-1">Confirm password</label>
                    <input className="input" type={showPw ? 'text' : 'password'} required value={form.confirm} onChange={set('confirm')} placeholder="Repeat password" autoComplete="new-password" />
                  </div>
                )}
                {isLogin && (
                  <label className="flex items-center gap-2 text-body-sm text-on-surface-variant cursor-pointer">
                    <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="w-4 h-4 rounded accent-[#6366F1]" />
                    Remember me for 30 days
                  </label>
                )}
                <button className="btn btn-primary w-full h-11" disabled={busy}>
                  {busy ? 'Please wait…' : isLogin ? 'Sign In to TaskFlow' : 'Create Account'}
                  {!busy && <Icon name="arrow_forward" size={18} />}
                </button>
              </form>

              <p className="text-body-sm text-on-surface-variant mt-6 text-center">
                {isLogin ? "Don't have an account? " : 'Already have an account? '}
                <button className="text-primary font-semibold hover:underline" onClick={() => { setMode(isLogin ? 'register' : 'login'); setError(''); }}>
                  {isLogin ? 'Sign up for free' : 'Sign in'}
                </button>
              </p>
            </div>
          </div>
        </div>

        {/* brand side */}
        <div className="hidden lg:flex flex-col justify-between p-10 text-white bg-gradient-to-br from-[#4338ca] via-[#4f46e5] to-[#6d38d4] relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
          <div className="flex items-center justify-between relative">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 text-label-md"><Icon name="star" filled size={16} className="text-amber-300" /> 4.9 / 5 from 10k+ teams</span>
            <span className="text-label-sm uppercase tracking-widest text-white/70 flex items-center gap-2">Real-time engine <span className="w-2 h-2 rounded-full bg-emerald-400" /></span>
          </div>

          <div className="relative">
            <h2 className="text-headline-xl">Manage projects with effortless speed and team harmony.</h2>
            <p className="text-body-lg text-white/75 mt-4 max-w-md">Real-time Kanban boards, task comments and instant notifications for your whole team.</p>

            <div className="mt-8 max-w-sm relative">
              <div className="bg-white text-on-surface rounded-xl p-4 shadow-drag">
                <div className="flex items-center justify-between text-label-sm text-slate-500 mb-3"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500" />DONE LANE</span><Icon name="more_horiz" size={18} /></div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <span className="pill bg-emerald-50 text-emerald-600">Done</span>
                  <p className="text-headline-sm mt-2">Launch Website v2</p>
                  <p className="text-body-sm text-slate-500">Final SEO check and responsive QA verified.</p>
                  <div className="flex items-center justify-between mt-3 text-body-sm text-slate-500"><span className="flex items-center gap-1"><Icon name="checklist" size={16} />5/5</span><span className="flex -space-x-2"><i className="w-6 h-6 rounded-full bg-primary-fixed ring-2 ring-white" /><i className="w-6 h-6 rounded-full bg-tertiary-fixed ring-2 ring-white" /></span></div>
                </div>
              </div>
              <span className="absolute -bottom-3 right-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-tertiary-container text-white text-label-md shadow-drag"><Icon name="edit" size={14} /> Sara is typing…</span>
            </div>
          </div>
          <p className="text-label-sm text-white/60 relative">Plan · Assign · Collaborate · Ship</p>
        </div>
      </div>
    </div>
  );
}
