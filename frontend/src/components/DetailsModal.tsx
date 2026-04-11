'use client';

import { ReactNode } from 'react';
import Modal from '@/components/Modal';

export interface DetailItem {
  label: string;
  value: ReactNode;
}

interface DetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  items: DetailItem[];
  /** Optional block below the detail grid (same typography / card styles as parent page) */
  extra?: ReactNode;
}

export default function DetailsModal({
  isOpen,
  onClose,
  title,
  subtitle,
  items,
  extra
}: DetailsModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle || 'Complete record information'}
      maxWidth="max-w-[760px]"
      footer={(
        <button type="button" onClick={onClose} className="btn-secondary min-w-[120px]">
          Close
        </button>
      )}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {items.map((item) => (
          <div key={item.label} className="rounded-lg border border-dark-100 dark:border-white/10 bg-dark-50/40 dark:bg-white/[0.02] p-3">
            <p className="text-[10px] uppercase tracking-widest text-dark-500 mb-1">{item.label}</p>
            <div className="text-sm text-dark-900 dark:text-dark-100 break-words">{item.value || '—'}</div>
          </div>
        ))}
      </div>
      {extra ? <div className="mt-4 space-y-3">{extra}</div> : null}
    </Modal>
  );
}
