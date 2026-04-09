'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatItem {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  color?: string;
  bgIcon?: string;
}

interface StatsSummaryProps {
  stats: StatItem[];
  loading?: boolean;
}

export default function StatsSummary({ stats, loading }: StatsSummaryProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass-card p-5 animate-pulse">
            <div className="w-10 h-10 rounded-xl bg-dark-100 dark:bg-dark-800 mb-4" />
            <div className="h-7 w-16 bg-dark-100 dark:bg-dark-800 rounded mb-2" />
            <div className="h-3 w-24 bg-dark-100 dark:bg-dark-800 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {stats.map((card) => (
        <div key={card.label} className="glass-card-hover p-5 relative overflow-hidden group">
          {card.icon && (
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.bgIcon || 'bg-saffron-500/10'} mb-4 group-hover:scale-110 transition-transform`}>
              <card.icon className={`w-5 h-5 ${card.color || 'text-saffron-500'}`} />
            </div>
          )}
          <div className="text-2xl font-medium text-dark-900 dark:text-dark-100 truncate">
            {card.value}
          </div>
          <div className="text-[10px] text-dark-500 font-medium uppercase tracking-[2px] mt-1 truncate">
            {card.label}
          </div>
        </div>
      ))}
    </div>
  );
}
