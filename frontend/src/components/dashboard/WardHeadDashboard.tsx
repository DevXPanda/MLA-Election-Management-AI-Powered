'use client';

import React from 'react';
import { LayoutDashboard, Users, ClipboardList, ListTodo, Map as MapIcon, ChevronRight, Activity, TrendingUp } from 'lucide-react';
import { DashboardStats } from '@/types';
import Link from 'next/link';

interface DashboardProps {
  stats: DashboardStats;
  chartDefaults: any;
}

export default function WardHeadDashboard({ stats }: DashboardProps) {
  const { total_voters, total_surveys, total_tasks, active_workers } = stats.stats;
  const boothProgress = stats.lists.booth_progress || [];

  const statCards = [
    { label: 'Ward Voters', value: total_voters, icon: Users, color: 'text-blue-400', bgIcon: 'bg-blue-500/12' },
    { label: 'Ward Surveys', value: total_surveys, icon: ClipboardList, color: 'text-purple-400', bgIcon: 'bg-purple-500/12' },
    { label: 'Open Tasks', value: total_tasks, icon: ListTodo, color: 'text-amber-400', bgIcon: 'bg-amber-500/12' },
    { label: 'Active Staff', value: active_workers, icon: Activity, color: 'text-emerald-400', bgIcon: 'bg-emerald-500/12' },
  ];

  return (
    <div className="p-8 pb-12">
      {/* Header Section */}
      <div className="mb-8">
        <h1 className="text-2xl font-black text-dark-900 dark:text-white flex items-center gap-3 mb-0">
          <LayoutDashboard className="w-6 h-6 text-saffron-500" /> Ward Command Center
        </h1>
        <p className="text-sm text-dark-500 font-medium mt-1">Monitoring execution across {boothProgress.length} booths.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {statCards.map((card) => (
          <div key={card.label} className="glass-card-hover p-6 relative overflow-hidden group">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${card.bgIcon} mb-5 group-hover:scale-110 transition-transform`}>
              <card.icon className={`w-6 h-6 ${card.color}`} />
            </div>
            <div className="text-3xl font-black text-dark-900 dark:text-white tracking-tight">{card.value}</div>
            <div className="text-[11px] text-dark-500 font-black uppercase tracking-[2px] mt-2">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
        <div className="glass-card overflow-hidden">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-base font-black text-dark-900 dark:text-white flex items-center gap-3">
              <MapIcon className="w-5 h-5 text-saffron-500" /> Booth-Wise Execution Progress
            </h3>
            <span className="text-[10px] font-black text-dark-500 uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full border border-white/5">Sorted by Coverage</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.02]">
                  <th className="px-6 py-4 text-[10px] font-black text-dark-600 uppercase tracking-widest">Booth Name</th>
                  <th className="px-6 py-4 text-[10px] font-black text-dark-600 uppercase tracking-widest">Total Voters</th>
                  <th className="px-6 py-4 text-[10px] font-black text-dark-600 uppercase tracking-widest">Surveys</th>
                  <th className="px-6 py-4 text-[10px] font-black text-dark-600 uppercase tracking-widest">Coverage %</th>
                  <th className="px-6 py-4 text-[10px] font-black text-dark-600 uppercase tracking-widest">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {boothProgress.map((booth: any) => (
                  <tr key={booth.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-5">
                      <div className="text-sm font-bold text-dark-900 dark:text-white group-hover:text-saffron-500 transition-colors">{booth.name}</div>
                      <div className="text-[10px] text-dark-500 font-bold uppercase mt-0.5 tracking-tight">ID: {booth.id}</div>
                    </td>
                    <td className="px-6 py-5 text-sm font-black text-dark-100">{booth.voter_count}</td>
                    <td className="px-6 py-5 text-sm font-black text-dark-100">{booth.survey_count}</td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                         <div className="flex-1 h-2 bg-dark-800 rounded-full overflow-hidden max-w-[120px] relative">
                            <div 
                              className={`h-full rounded-full transition-all duration-1000 ${parseFloat(booth.coverage) >= 60 ? 'bg-emerald-500' : parseFloat(booth.coverage) >= 30 ? 'bg-amber-500' : 'bg-red-500'}`}
                              style={{ width: `${booth.coverage}%` }}
                            />
                         </div>
                         <span className="text-[11px] font-black text-dark-100">{Math.round(booth.coverage)}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <Link href={`/dashboard/voters?booth_id=${booth.id}`} className="p-2 rounded-lg bg-dark-800 text-dark-400 hover:bg-saffron-500/10 hover:text-saffron-400 transition-all inline-flex items-center justify-center border border-white/5 group-hover:border-saffron-500/20">
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
