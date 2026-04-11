'use client';

import { useEffect, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 'max-w-[600px]'
}: ModalProps) {
  // ESC key to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
      document.body.classList.add('modal-open');
    }
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
      document.body.classList.remove('modal-open');
    };
  }, [isOpen, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div 
      className={`modal-overlay ${isOpen ? 'active' : ''}`} 
      onClick={onClose}
    >
      <div 
        className={`modal-panel ${maxWidth} w-[96vw] sm:w-[92vw] lg:w-[88vw]`} 
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header shrink-0">
          <div className="min-w-0 flex-1 pr-4">
            <h3 className="text-lg sm:text-xl font-bold text-dark-800 dark:text-white leading-tight truncate">{title}</h3>
            {subtitle && <p className="text-[10px] sm:text-xs text-dark-500 mt-1 truncate">{subtitle}</p>}
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 rounded-lg bg-dark-100 dark:bg-white/[0.05] flex items-center justify-center text-dark-500 hover:bg-red-500/10 hover:text-red-500 transition-all duration-200 flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="modal-body custom-scrollbar">
          {children}
        </div>

        {footer && (
          <div className="modal-footer shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
