import { toast } from 'react-hot-toast';
import { ShieldAlert, AlertCircle, CheckCircle2, Trash2 } from 'lucide-react';

/**
 * Premium Toast Utility
 * Replaces native alert() and confirm() with high-fidelity UI components
 */

export const showToast = {
  success: (msg: string) => {
    toast.success(msg);
  },
  error: (msg: string) => {
    toast.error(msg);
  },
  info: (msg: string) => {
    toast(msg, {
      icon: <AlertCircle className="w-5 h-5 text-blue-400" />,
      style: {
        border: '1px solid rgba(59, 130, 246, 0.2)',
      }
    });
  },
  
  /**
   * Premium confirmation toast
   * @param title Title of the confirmation
   * @param msg Description or question
   * @param onConfirm Callback when confirmed
   * @param confirmLabel Label for the confirm button
   */
  confirm: (title: string, msg: string, onConfirm: () => void, confirmLabel: string = 'Confirm') => {
    toast((t) => (
      <div className="flex flex-col gap-3 min-w-[280px]">
        <div className="flex items-center gap-2.5 border-b border-dark-100 dark:border-white/[0.05] pb-2.5">
          <div className={`p-1.5 rounded-lg ${confirmLabel.toLowerCase().includes('delete') ? 'bg-red-500/10' : 'bg-saffron-500/10'}`}>
            {confirmLabel.toLowerCase().includes('delete') ? (
              <Trash2 size={16} className="text-red-500" />
            ) : (
              <ShieldAlert size={16} className="text-saffron-500" />
            )}
          </div>
          <span className="font-bold text-[14px] tracking-tight text-dark-900 dark:text-white">{title}</span>
        </div>
        <p className="text-[12px] text-dark-500 dark:text-dark-400 leading-relaxed font-inter px-1">{msg}</p>
        <div className="flex justify-end gap-2.5 pt-1.5 font-inter">
          <button 
            onClick={() => toast.dismiss(t.id)}
            className="px-4 py-2 rounded-xl bg-dark-50 dark:bg-white/[0.05] text-[11px] font-bold uppercase tracking-widest text-dark-600 dark:text-dark-300 hover:bg-dark-100 dark:hover:bg-white/[0.08] hover:text-dark-900 dark:hover:text-white transition-all border border-dark-200 dark:border-white/[0.05]"
          >
            Cancel
          </button>
          <button 
            onClick={() => {
              onConfirm();
              toast.dismiss(t.id);
            }}
            className={`px-4 py-2 rounded-xl text-white text-[11px] font-bold uppercase tracking-widest transition-all shadow-lg ${
              confirmLabel.toLowerCase().includes('delete') 
                ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' 
                : 'bg-saffron-500 hover:bg-saffron-600 shadow-saffron-500/20'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    ), {
      duration: Infinity,
      position: 'top-right',
      style: {
        background: 'var(--toast-bg)',
        color: 'var(--toast-color)',
        borderRadius: '20px',
        padding: '16px',
        border: '1px solid var(--toast-border)',
        boxShadow: 'var(--toast-shadow)',
      }
    });
  }
};
