import { createContext, useCallback, useContext, useState } from 'react';
import { Icon } from '../components/ui';
import { cx } from '../utils/helpers';

const ToastContext = createContext(null);
export const useToast = () => useContext(ToastContext);

const STYLES = {
  info: { icon: 'notifications', color: 'bg-primary-fixed text-primary' },
  success: { icon: 'check_circle', color: 'bg-emerald-100 text-emerald-700' },
  error: { icon: 'error', color: 'bg-red-100 text-red-600' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback((message, type = 'info', icon) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t.slice(-3), { id, message, type, icon }]);
    setTimeout(() => dismiss(id), 4500);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed z-[100] top-4 right-4 left-4 sm:left-auto flex flex-col gap-2 sm:w-96 pointer-events-none">
        {toasts.map((t) => {
          const s = STYLES[t.type] || STYLES.info;
          return (
            <div key={t.id} className="toast-in pointer-events-auto bg-white border border-slate-200 shadow-modal rounded-xl p-3 flex items-start gap-3">
              <span className={cx('w-8 h-8 rounded-full flex items-center justify-center shrink-0', s.color)}><Icon name={t.icon || s.icon} size={18} /></span>
              <p className="text-body-md text-on-surface flex-1 pt-1">{t.message}</p>
              <button onClick={() => dismiss(t.id)} className="text-slate-400 hover:text-slate-600" aria-label="Dismiss"><Icon name="close" size={18} /></button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
