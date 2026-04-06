'use client';

import { Users, Vote, ClipboardList, ListTodo, Calendar, UserCheck, Activity, ArrowUpRight } from 'lucide-react';
import { Doughnut, Line } from 'react-chartjs-2';
import { format, formatDistanceToNow } from 'date-fns';
import { DashboardStats } from '@/types';

interface DashboardProps {
  stats: DashboardStats;
  chartDefaults: any;
}

export default function AdminDashboard({ stats, chartDefaults }: DashboardProps) {
  const statCards = [
    { label: 'Total Users', value: stats.stats.total_users, icon: Users, color: 'text-blue-600 dark:text-blue-400', bgIcon: 'bg-blue-500/10 dark:bg-blue-500/12', glow: 'shadow-blue-500/20' },
    { label: 'Total Voters', value: stats.stats.total_voters, icon: Vote, color: 'text-green-600 dark:text-green-400', bgIcon: 'bg-green-500/10 dark:bg-green-500/12', glow: 'shadow-green-500/20' },
    { label: 'Total Surveys', value: stats.stats.total_surveys, icon: ClipboardList, color: 'text-amber-600 dark:text-amber-400', bgIcon: 'bg-amber-500/10 dark:bg-amber-500/12', glow: 'shadow-amber-500/20' },
    { label: 'Tasks Active', value: stats.stats.total_tasks, icon: ListTodo, color: 'text-purple-600 dark:text-purple-400', bgIcon: 'bg-purple-500/10 dark:bg-purple-500/12', glow: 'shadow-purple-500/20' },
    { label: 'Total Events', value: stats.stats.total_events, icon: Calendar, color: 'text-pink-600 dark:text-pink-400', bgIcon: 'bg-pink-500/10 dark:bg-pink-500/12', glow: 'shadow-pink-500/20' },
    { label: 'Total Workers', value: stats.stats.active_workers, icon: UserCheck, color: 'text-emerald-600 dark:text-emerald-400', bgIcon: 'bg-emerald-500/10 dark:bg-emerald-500/12', glow: 'shadow-emerald-500/20' },
  ];

  const supportData = {
    labels: stats.charts.support_stats?.map((s) => s.support_status.toUpperCase()) || [],
    datasets: [{
      data: stats.charts.support_stats?.map((s) => parseInt(s.count)) || [],
      backgroundColor: ['#16a34a', '#d97706', '#dc2626', '#475569'],
      borderWidth: 0,
    }],
  };

  const surveyTrendData = {
    labels: stats.charts.survey_trend?.map((s) => format(new Date(s.date), 'dd MMM')) || [],
    datasets: [{
      label: 'Surveys',
      data: stats.charts.survey_trend?.map((s) => parseInt(s.count)) || [],
      borderColor: '#f97316',
      backgroundColor: 'rgba(249, 115, 22, 0.1)',
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      borderWidth: 2,
    }],
  };

  return (
    <div className="p-8 pb-12 transition-colors duration-300">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5 mb-8">
        {statCards.map((card) => (
          <div key={card.label} className={`glass-card-hover p-5 relative overflow-hidden group border border-dark-100/50 dark:border-white/5 transition-all duration-300 hover:scale-[1.02] hover:${card.glow} shadow-lg`}>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${card.bgIcon} mb-5 group-hover:scale-110 transition-transform duration-300`}>
              <card.icon className={`w-6 h-6 ${card.color}`} />
            </div>
            <div className="text-3xl font-black text-dark-900 dark:text-white tracking-tight leading-none">{(card.value || 0).toLocaleString()}</div>
            <div className="text-[11px] text-dark-500 font-black uppercase tracking-[2px] mt-2 whitespace-nowrap leading-none opacity-80">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="glass-card p-6 border border-dark-100/50 dark:border-white/5 shadow-xl">
          <h3 className="text-base font-black text-dark-900 dark:text-white mb-8 flex items-center gap-2">
            <Activity className="w-5 h-5 text-saffron-500" /> Global Voter Sentiment
          </h3>
          <div className="h-[220px]">
            <Doughnut data={supportData} options={{ ...chartDefaults, cutout: '75%' }} />
          </div>
          <div className="flex flex-wrap gap-2 mt-6 justify-center">
            {stats.charts.support_stats?.map((s, i) => (
              <div key={s.support_status} className="px-3 py-1.5 rounded-lg bg-dark-50 dark:bg-dark-800/60 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider border border-dark-100 dark:border-transparent transition-colors">
                <span className={`w-1.5 h-1.5 rounded-full ${['bg-green-500', 'bg-amber-500', 'bg-red-500', 'bg-dark-500'][i % 4]}`} />
                <span className="text-dark-600 dark:text-dark-400">{s.support_status}: {s.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-6 lg:col-span-2 border border-dark-100/50 dark:border-white/5 shadow-xl">
          <h3 className="text-base font-black text-dark-900 dark:text-white mb-8 flex items-center gap-2">
            <ArrowUpRight className="w-5 h-5 text-emerald-500" /> Campaign Growth
          </h3>
          <div className="h-[280px]">
            <Line data={surveyTrendData} options={chartDefaults} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card overflow-hidden">
          <div className="p-6 border-b border-dark-100 dark:border-white/5 flex items-center justify-between">
            <h3 className="text-base font-bold text-dark-900 dark:text-white">Regional Top Performers</h3>
            <ArrowUpRight className="w-4 h-4 text-dark-500" />
          </div>
          <div className="p-4 space-y-2">
            {stats.lists.top_performers?.map((worker, i) => (
              <div key={worker.name} className="flex items-center justify-between p-3 rounded-xl hover:bg-dark-50 dark:hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-dark-100 dark:bg-dark-800 flex items-center justify-center text-xs font-bold text-dark-500 dark:text-dark-400">{i + 1}</div>
                  <div className="text-sm font-bold text-dark-800 dark:text-dark-100">{worker.name}</div>
                </div>
                <div className="flex gap-4 text-[11px] font-black uppercase tracking-wider">
                  <span className="bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-lg border border-green-500/12">{worker.surveys_count} Surveys</span>
                  <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-lg border border-blue-500/12">{worker.tasks_completed} Tasks</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card overflow-hidden">
          <div className="p-6 border-b border-dark-100 dark:border-white/5">
            <h3 className="text-base font-bold text-dark-900 dark:text-white">Live Operation Logs</h3>
          </div>
          <div className="max-h-[320px] overflow-y-auto p-4 custom-scrollbar">
            {stats.lists.recent_activity?.map((activity) => (
              <div key={activity.id} className="flex gap-3 p-3 rounded-xl hover:bg-dark-50 dark:hover:bg-white/5 transition-all">
                <div className="w-8 h-8 rounded-full bg-dark-100 dark:bg-dark-800 flex items-center justify-center shrink-0">
                  <Activity className="w-4 h-4 text-dark-500 dark:text-dark-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-dark-600 dark:text-dark-300">
                    <span className="font-bold text-dark-900 dark:text-dark-100">{activity.user_name}</span> {activity.action.toLowerCase().replace(/_/g, ' ')}
                  </p>
                  <div className="text-[10px] font-bold text-dark-400 dark:text-dark-500 uppercase mt-1">
                    {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })} • {activity.module}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
