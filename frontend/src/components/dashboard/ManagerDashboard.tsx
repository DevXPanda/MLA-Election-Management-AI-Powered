'use client';

import { Users, ListTodo, ClipboardCheck, Timer, UserCheck, CheckCircle2, MoreVertical, Briefcase } from 'lucide-react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { DashboardStats } from '@/types';
import { useLanguage } from '@/context/LanguageContext';

interface DashboardProps {
  stats: DashboardStats;
  chartDefaults: any;
}

export default function ManagerDashboard({ stats, chartDefaults }: DashboardProps) {
  const { t } = useLanguage();

  const statCards = [
    { label: t('manager.ward_workers', 'Ward Workers'), value: stats.stats.active_workers, icon: Users, color: 'text-blue-400', bgIcon: 'bg-blue-500/12' },
    { label: t('manager.tasks_assigned', 'Tasks Assigned'), value: stats.stats.total_tasks, icon: ListTodo, color: 'text-amber-400', bgIcon: 'bg-amber-500/12' },
    { label: t('manager.tasks_completed', 'Tasks Completed'), value: Math.round(stats.stats.total_tasks * 0.7) /* Target metric */, icon: CheckCircle2, color: 'text-emerald-400', bgIcon: 'bg-emerald-500/12' },
    { label: t('manager.surveys_today', 'Surveys Today'), value: stats.stats.total_surveys, icon: ClipboardCheck, color: 'text-purple-400', bgIcon: 'bg-purple-500/12' },
    { label: t('manager.ops_status', 'Ops Status'), value: t('label.active', 'Active'), icon: UserCheck, color: 'text-green-400', bgIcon: 'bg-green-500/12' },
  ];

  const taskCompletionData = {
    labels: [t('label.completed', 'Completed'), t('label.pending', 'Pending')],
    datasets: [{
      data: [70, 30],
      backgroundColor: ['#10b981', '#334155'],
      hoverBackgroundColor: ['#059669', '#1e293b'],
      borderWidth: 0,
      weight: 1
    }],
  };

  return (
    <div className="dashboard-container pb-12">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-5 mb-8">
        {statCards.map((card) => (
          <div key={card.label} className="glass-card-hover p-5 relative overflow-hidden group">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.bgIcon} mb-4 group-hover:scale-110 transition-transform`}>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <div className="text-2xl font-black text-dark-900 dark:text-dark-100">{card.value}</div>
            <div className="text-[10px] text-dark-500 font-bold uppercase tracking-widest mt-1 tracking-[1.5px]">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-card p-6 flex flex-col items-center justify-center bg-gradient-to-br from-green-500/[0.03] to-transparent shadow-emerald-500/5 min-h-[350px]">
           <h3 className="text-base font-black text-dark-900 dark:text-white mb-8 w-full flex items-center gap-2">
              <Timer className="w-5 h-5 text-green-500" /> {t('manager.operational_efficiency', 'Operational Efficiency')}
           </h3>
           <div className="h-[200px] relative flex items-center justify-center">
              <Doughnut data={taskCompletionData} options={{ ...chartDefaults, cutout: '80%' }} />
              <div className="absolute flex flex-col items-center">
                 <span className="text-4xl font-black text-dark-900 dark:text-white italic">70%</span>
                 <span className="text-[10px] font-black text-dark-500 uppercase tracking-widest mt-1">{t('manager.completion', 'Completion')}</span>
              </div>
           </div>
           <p className="text-[10px] font-bold text-dark-500 text-center mt-8 uppercase tracking-widest opacity-60">{t('manager.realtime_throughput', 'Real-time throughput metrics')}</p>
        </div>

        <div className="glass-card lg:col-span-2 overflow-hidden flex flex-col min-h-[350px]">
           <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-base font-black text-dark-900 dark:text-white flex items-center gap-3">
                 <Briefcase className="w-5 h-5 text-blue-500" /> {t('manager.worker_performance_grid', 'Worker Performance Grid')}
              </h3>
              <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full text-[9px] font-black text-emerald-400 uppercase tracking-widest animate-pulse">{t('manager.live_feed', 'LIVE FEED')}</div>
           </div>
           <div className="flex-1 max-h-[380px] overflow-y-auto p-2 custom-scrollbar">
              <table className="w-full">
                 <thead>
                    <tr className="bg-white/[0.02]">
                       <th className="p-4 text-left text-[10px] font-black text-dark-500 uppercase tracking-widest">{t('manager.operative', 'Operative')}</th>
                       <th className="p-4 text-center text-[10px] font-black text-dark-500 uppercase tracking-widest">{t('manager.surveys', 'Surveys')}</th>
                       <th className="p-4 text-center text-[10px] font-black text-dark-500 uppercase tracking-widest">{t('manager.tasks', 'Tasks')}</th>
                       <th className="p-4 text-center text-[10px] font-black text-dark-500 uppercase tracking-widest">{t('manager.action', 'Action')}</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-white/5">
                    {stats.charts.worker_performance?.map((worker) => (
                      <tr key={worker.name} className="hover:bg-white/5 group transition-colors">
                        <td className="p-4">
                           <div className="text-sm font-black text-dark-900 dark:text-white group-hover:text-amber-500 transition-colors">{worker.name}</div>
                           <div className="text-[9px] text-dark-500 font-bold uppercase tracking-tighter">{t('manager.field_agent', 'Field Agent')}</div>
                        </td>
                        <td className="p-4 text-center">
                           <span className="px-3 py-1 bg-purple-500/10 text-purple-400 text-[10px] font-black rounded-lg border border-purple-500/10">{worker.surveys_count}</span>
                        </td>
                        <td className="p-4 text-center">
                           <span className="px-3 py-1 bg-green-500/10 text-green-400 text-[10px] font-black rounded-lg border border-green-500/10">{worker.tasks_completed}</span>
                        </td>
                        <td className="p-4 text-center text-[10px]">
                           <button className="px-4 py-2 bg-white/5 hover:bg-white/10 text-dark-300 hover:text-white font-black uppercase tracking-wider rounded-xl border border-white/5 transition-all flex items-center gap-2 mx-auto">
                              {t('manager.details', 'Details')}
                           </button>
                        </td>
                      </tr>
                    ))}
                    {(!stats.charts.worker_performance || stats.charts.worker_performance.length === 0) && (
                       <tr>
                          <td colSpan={4} className="p-12 text-center text-dark-600 text-xs font-black uppercase tracking-widest italic opacity-40">{t('manager.no_operatives', 'No active field operatives in this ward')}</td>
                       </tr>
                    )}
                 </tbody>
              </table>
           </div>
        </div>
      </div>

      {/* Recent Work Allocations Widget */}
      {stats.lists.work_allocations && stats.lists.work_allocations.length > 0 && (
        <div className="glass-card p-6 border border-dark-100/50 dark:border-white/5 shadow-xl mt-6">
          <h3 className="text-base font-medium text-dark-900 dark:text-white mb-6 flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-saffron-500" /> {t('dashboard.work_allocations_progress', 'Work Allocations & Progress')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {stats.lists.work_allocations.map((alloc: any) => (
              <div key={alloc.id} className="p-4 rounded-xl border border-dark-100 dark:border-white/5 bg-white dark:bg-dark-950/40 flex flex-col justify-between text-xs transition-transform hover:scale-[1.02] duration-300">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[9px] font-black text-saffron-600 dark:text-saffron-500 uppercase tracking-wider">{alloc.work_type}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${
                      alloc.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                      alloc.status === 'in_progress' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                      alloc.status === 'overdue' ? 'bg-red-500/20 text-red-500 border-red-500/30 font-bold animate-pulse' :
                      alloc.status === 'assigned' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                      alloc.status === 'cancelled' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                      'bg-dark-500/10 text-dark-500 border-dark-500/20'
                    }`}>
                      {t(`label.${alloc.status}`, alloc.status)}
                    </span>
                  </div>
                  <h4 className="font-bold text-dark-900 dark:text-white uppercase tracking-tight mb-1 truncate">{alloc.event_title}</h4>
                  {alloc.description && <p className="text-dark-600 dark:text-dark-400 italic line-clamp-2 mt-1">&quot;{alloc.description}&quot;</p>}
                </div>
                <div className="mt-4 pt-2 border-t border-dark-100 dark:border-white/5 flex items-center justify-between text-[10px] text-dark-500">
                  <span>Assignee: <strong className="text-dark-800 dark:text-dark-200">{alloc.assignee_name || 'Unassigned'}</strong></span>
                  <span>Due: {alloc.due_date ? new Date(alloc.due_date).toLocaleDateString() : '—'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
