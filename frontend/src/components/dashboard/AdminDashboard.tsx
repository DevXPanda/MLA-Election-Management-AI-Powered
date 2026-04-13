'use client';

import { Users, Vote, ClipboardList, ListTodo, Calendar, UserCheck, Activity, ArrowUpRight, Target, BarChart3 } from 'lucide-react';
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
      backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#64748b'],
      borderWidth: 0,
    }],
  };

  const surveyTrendData = {
    labels: stats.charts.survey_trend?.map((s) => format(new Date(s.date), 'dd MMM')) || [],
    datasets: [{
      label: 'Campaign Growth',
      data: stats.charts.survey_trend?.map((s) => parseInt(s.count)) || [],
      borderColor: '#f97316',
      backgroundColor: 'rgba(249, 115, 22, 0.12)',
      fill: true,
      tension: 0.35,
      pointRadius: 3,
      pointBackgroundColor: '#f97316',
      pointBorderColor: '#ffffff',
      pointBorderWidth: 2,
      pointHoverRadius: 6,
      borderWidth: 3,
    }],
  };

  const genderData = {
    labels: stats.charts.gender_breakdown?.map(g => g.gender) || [],
    datasets: [{
      data: stats.charts.gender_breakdown?.map(g => parseInt(g.count)) || [],
      backgroundColor: ['#3b82f6', '#ec4899', '#64748b'],
      borderWidth: 0,
    }],
  };

  const taskBreakdownData = {
    labels: stats.charts.task_status?.map(t => t.status.replace(/_/g, ' ').toUpperCase()) || [],
    datasets: [{
      data: stats.charts.task_status?.map(t => parseInt(t.count)) || [],
      backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#334155'],
      borderWidth: 0,
    }],
  };

  return (
    <div className="dashboard-container pb-12 transition-colors duration-300">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5 mb-8">
        {statCards.map((card) => (
          <div key={card.label} className={`glass-card-hover p-5 relative overflow-hidden group border border-dark-100/50 dark:border-white/5 transition-all duration-300 hover:scale-[1.02] hover:${card.glow} shadow-lg`}>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${card.bgIcon} mb-5 group-hover:scale-110 transition-transform duration-300`}>
              <card.icon className={`w-6 h-6 ${card.color}`} />
            </div>
            <div className="text-3xl font-medium text-dark-900 dark:text-white tracking-tight leading-none">{(card.value || 0).toLocaleString()}</div>
            <div className="text-[11px] text-dark-500 font-medium uppercase tracking-[2px] mt-2 whitespace-nowrap leading-none opacity-80">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="glass-card p-6 border border-dark-100/50 dark:border-white/5 shadow-xl">
          <h3 className="text-base font-medium text-dark-900 dark:text-white mb-8 flex items-center gap-2">
            <Activity className="w-5 h-5 text-saffron-500" /> Global Voter Sentiment
          </h3>
          <div className="h-[220px]">
            <Doughnut data={supportData} options={{ ...chartDefaults, cutout: '75%' }} />
          </div>
          <div className="flex flex-wrap gap-2 mt-6 justify-center">
            {stats.charts.support_stats?.map((s, i) => (
              <div key={s.support_status} className="px-3 py-1.5 rounded-lg bg-dark-50 dark:bg-dark-800/60 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider border border-dark-100 dark:border-transparent transition-colors">
                <span className={`w-1.5 h-1.5 rounded-full ${['bg-green-500', 'bg-amber-500', 'bg-red-500', 'bg-dark-500'][i % 4]}`} />
                <span className="text-dark-600 dark:text-dark-400">{s.support_status}: {s.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-6 lg:col-span-2 border border-dark-100/50 dark:border-white/5 shadow-xl">
          <h3 className="text-base font-medium text-dark-900 dark:text-white mb-8 flex items-center gap-2">
            <ArrowUpRight className="w-5 h-5 text-saffron-500" /> Campaign Growth
          </h3>
          <div className="h-[280px]">
            <Line data={surveyTrendData} options={chartDefaults} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="glass-card p-6 border border-dark-100/50 dark:border-white/5 shadow-xl">
          <h3 className="text-base font-medium text-dark-900 dark:text-white mb-8 flex items-center gap-2">
             <Users className="w-5 h-5 text-blue-500" /> Gender Distribution
          </h3>
          <div className="h-[220px]">
            <Doughnut data={genderData} options={{ ...chartDefaults, cutout: '75%' }} />
          </div>
          <div className="flex flex-wrap gap-2 mt-6 justify-center">
            {stats.charts.gender_breakdown?.map((g, i) => (
              <div key={i} className="px-3 py-1.5 rounded-lg bg-dark-50 dark:bg-dark-800/40 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider border border-dark-100 dark:border-transparent">
                <span className={`w-1.5 h-1.5 rounded-full ${['bg-blue-500', 'bg-pink-500', 'bg-slate-500'][i % 3]}`} />
                <span className="text-dark-600 dark:text-dark-400">{g.gender}: {g.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-6 border border-dark-100/50 dark:border-white/5 shadow-xl">
          <h3 className="text-base font-medium text-dark-900 dark:text-white mb-8 flex items-center gap-2">
             <ListTodo className="w-5 h-5 text-purple-500" /> Task Efficiency
          </h3>
          <div className="h-[220px]">
            <Doughnut data={taskBreakdownData} options={{ ...chartDefaults, cutout: '75%' }} />
          </div>
          <div className="flex flex-wrap gap-2 mt-6 justify-center">
            {stats.charts.task_status?.map((t, i) => (
              <div key={i} className="px-3 py-1.5 rounded-lg bg-dark-50 dark:bg-dark-800/40 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider border border-dark-100 dark:border-transparent">
                <span className={`w-1.5 h-1.5 rounded-full ${['bg-green-500', 'bg-amber-500', 'bg-red-500', 'bg-indigo-500'][i % 4]}`} />
                <span className="text-dark-600 dark:text-dark-400">{t.status.split('_').join(' ')}: {t.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card overflow-hidden h-full border border-dark-100/50 dark:border-white/5 shadow-xl">
          <div className="p-6 border-b border-dark-100 dark:border-white/5 flex items-center justify-between bg-dark-50/50 dark:bg-white/[0.02]">
            <h3 className="text-base font-medium text-dark-900 dark:text-white flex items-center gap-2">
               <UserCheck className="w-5 h-5 text-emerald-500" /> Top Performers
            </h3>
            <ArrowUpRight className="w-4 h-4 text-dark-500" />
          </div>
          <div className="p-4 space-y-2">
            {stats.lists.top_performers?.slice(0, 5).map((worker, i) => (
              <div key={worker.name} className="flex items-center justify-between p-3 rounded-xl hover:bg-dark-50 dark:hover:bg-white/5 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-dark-100 dark:bg-dark-800 flex items-center justify-center text-xs font-bold text-dark-500 group-hover:text-emerald-500 transition-colors">{i + 1}</div>
                  <div className="text-sm font-medium text-dark-800 dark:text-dark-100">{worker.name}</div>
                </div>
                <div className="flex gap-4 text-[10px] font-bold uppercase tracking-wider">
                  <span className="text-emerald-500">{worker.surveys_count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card overflow-hidden border border-dark-100/50 dark:border-white/5 shadow-xl">
          <div className="p-6 border-b border-dark-100 dark:border-white/5 flex items-center justify-between bg-dark-50/50 dark:bg-white/[0.02]">
            <h3 className="text-base font-medium text-dark-900 dark:text-white flex items-center gap-2">
               <Activity className="w-5 h-5 text-saffron-500" /> Live Operation Logs
            </h3>
          </div>
          <div className="max-h-[360px] overflow-y-auto p-4 custom-scrollbar">
            {stats.lists.recent_activity?.map((activity) => (
              <div key={activity.id} className="flex gap-4 p-4 rounded-2xl hover:bg-dark-50 dark:hover:bg-white/5 transition-all mb-1">
                <div className="w-10 h-10 rounded-full bg-dark-100 dark:bg-dark-800 flex items-center justify-center shrink-0 border border-dark-200/50 dark:border-white/5">
                  <Activity className="w-4 h-4 text-dark-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-dark-700 dark:text-dark-300 leading-snug">
                    <span className="font-bold text-dark-900 dark:text-dark-100">{activity.user_name}</span> {activity.action.toLowerCase().replace(/_/g, ' ')}
                  </p>
                  <div className="flex justify-between items-center mt-2">
                    <div className="text-[10px] font-bold text-dark-400 dark:text-dark-500 uppercase tracking-widest bg-dark-100 dark:bg-dark-800 px-2 py-0.5 rounded-md">
                      {activity.module}
                    </div>
                    <div className="text-[10px] font-medium text-dark-400">
                      {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-8 border border-dark-100/50 dark:border-white/5 shadow-xl bg-gradient-to-br from-indigo-500/[0.03] to-transparent">
          <div className="mb-10 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-dark-900 dark:text-white flex items-center gap-3">
                <BarChart3 className="w-6 h-6 text-indigo-500" /> Key Constituency Issues
              </h3>
              <p className="text-xs text-dark-500 font-medium uppercase tracking-[2px] mt-2">Major Public Constraints</p>
            </div>
            <div className="bg-indigo-500/10 text-indigo-500 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">LIVE DATA</div>
          </div>
          
          <div className="space-y-6">
            {stats.stats.top_issues?.slice(0, 5).map((issue, i) => (
              <div key={i} className="relative group">
                <div className="flex justify-between items-center mb-2.5">
                  <span className="text-[11px] font-black text-dark-800 dark:text-dark-300 uppercase tracking-[1.5px] group-hover:text-indigo-500 transition-colors">
                    {issue.name}
                  </span>
                  <span className="text-[10px] font-black text-indigo-500">{issue.count} REF</span>
                </div>
                <div className="h-2 bg-dark-100 dark:bg-dark-800 rounded-full overflow-hidden p-[1px] border border-dark-200/50 dark:border-white/5">
                  <div 
                    className="h-full bg-gradient-to-r from-indigo-600 to-blue-400 rounded-full transition-all duration-1000 group-hover:shadow-[0_0_12px_rgba(79,70,229,0.3)]"
                    style={{ width: `${(parseInt(issue.count) / Math.max(...(stats.stats.top_issues?.map(it => parseInt(it.count)) || [1]))) * 100}%` }} 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
