'use client';

import { useEffect, ReactNode } from 'react';
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
    }
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  return (
    <div 
      className={`modal-overlay ${isOpen ? 'active' : ''}`} 
      onClick={onClose}
    >
      <div 
        className={`modal-panel ${maxWidth}`} 
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h3 className="text-xl font-bold text-dark-800 dark:text-white leading-tight">{title}</h3>
            {subtitle && <p className="text-xs text-dark-500 mt-1">{subtitle}</p>}
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 rounded-lg bg-dark-100 dark:bg-white/[0.05] flex items-center justify-center text-dark-500 hover:bg-red-500/10 hover:text-red-500 transition-all duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="modal-body custom-scrollbar">
          {children}
        </div>

        {footer && (
          <div className="modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
