'use client';

import React from 'react';
import { Users, ListTodo, Vote, Target, ShieldAlert, Activity, Map as MapIcon, TrendingUp, HelpCircle, BarChart3 } from 'lucide-react';
import { Doughnut, Bar, Line } from 'react-chartjs-2';
import { format } from 'date-fns';
import { DashboardStats } from '@/types';

interface DashboardProps {
  stats: DashboardStats;
  chartDefaults: any;
}

export default function MlaDashboard({ stats, chartDefaults }: DashboardProps) {
  const { booth_strength, top_issues } = stats.stats;
  
  const statCards = [
    { label: 'Total Voters', value: stats.stats.total_voters, icon: Vote, color: 'text-blue-400', bgIcon: 'bg-blue-500/12' },
    { label: 'Survey Coverage %', value: Math.round((stats.stats.total_surveys / (stats.stats.total_voters || 1)) * 100) + '%', icon: Target, color: 'text-purple-400', bgIcon: 'bg-purple-500/12' },
    { label: 'Strong Booths', value: booth_strength?.strong_booths || 0, icon: TrendingUp, color: 'text-green-400', bgIcon: 'bg-green-500/12' },
    { label: 'Weak Booths', value: booth_strength?.weak_booths || 0, icon: ShieldAlert, color: 'text-red-400', bgIcon: 'bg-red-500/12' },
    { label: 'Active Staff', value: stats.stats.active_workers, icon: Activity, color: 'text-emerald-400', bgIcon: 'bg-emerald-500/12' },
  ];

  const boothStrengthData = {
    labels: ['Strong', 'Competitive', 'Weak'],
    datasets: [{
      data: [
        booth_strength?.strong_booths || 0,
        booth_strength?.competitive_booths || 0,
        booth_strength?.weak_booths || 0
      ],
      backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
      borderWidth: 0,
      weight: 1
    }],
  };

  const issuesData = {
    labels: top_issues?.map(i => i.name) || [],
    datasets: [{
      label: 'Reported Counts',
      data: top_issues?.map(i => parseInt(i.count)) || [],
      backgroundColor: 'rgba(249, 115, 22, 0.2)',
      borderColor: '#f97316',
      borderWidth: 2,
      borderRadius: 12,
      borderSkipped: false,
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

  return (
    <div className="dashboard-container pb-12">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-5 mb-8">
        {statCards.map((card) => (
          <div key={card.label} className="glass-card-hover p-5 relative overflow-hidden group">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.bgIcon} mb-4`}>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <div className="text-2xl font-medium text-dark-900 dark:text-dark-100">{card.value}</div>
            <div className="text-[10px] text-dark-600 dark:text-dark-500 font-medium uppercase tracking-widest mt-1 tracking-[1.5px]">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="glass-card p-6">
          <h3 className="text-base font-medium text-dark-900 dark:text-white mb-6 flex items-center gap-2">
            <MapIcon className="w-5 h-5 text-saffron-500" /> Booth Strength
          </h3>
          <div className="h-[220px]">
            <Doughnut data={boothStrengthData} options={{ ...chartDefaults, cutout: '75%' }} />
          </div>
          <div className="mt-8 space-y-4">
            <div className="flex justify-between items-center bg-green-500/5 p-3 rounded-lg border border-green-500/10">
              <span className="text-[10px] font-medium text-green-600 dark:text-green-400 uppercase tracking-widest">Strong (&gt;60%)</span>
              <span className="text-sm font-medium text-dark-900 dark:text-white">{booth_strength?.strong_booths || 0}</span>
            </div>
            <div className="flex justify-between items-center bg-amber-500/5 p-3 rounded-lg border border-amber-500/10">
              <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 uppercase tracking-widest">Competitive (40-60)</span>
              <span className="text-sm font-medium text-dark-900 dark:text-white">{booth_strength?.competitive_booths || 0}</span>
            </div>
            <div className="flex justify-between items-center bg-red-500/5 p-3 rounded-lg border border-red-500/10">
              <span className="text-[10px] font-medium text-red-600 dark:text-red-400 uppercase tracking-widest">Weak (&lt;40%)</span>
              <span className="text-sm font-medium text-dark-900 dark:text-white">{booth_strength?.weak_booths || 0}</span>
            </div>
          </div>
        </div>

        <div className="glass-card p-6 border border-dark-100/50 dark:border-white/5 shadow-xl">
          <h3 className="text-base font-medium text-dark-900 dark:text-white mb-8 flex items-center gap-2">
             <Users className="w-5 h-5 text-blue-500" /> Gender Distribution
          </h3>
          <div className="h-[220px]">
            <Doughnut data={{
              labels: stats.charts.gender_breakdown?.map(g => g.gender) || [],
              datasets: [{
                data: stats.charts.gender_breakdown?.map(g => parseInt(g.count)) || [],
                backgroundColor: ['#3b82f6', '#ec4899', '#64748b'],
                borderWidth: 0,
              }]
            }} options={{ ...chartDefaults, cutout: '75%' }} />
          </div>
        </div>

        <div className="glass-card p-6 border border-dark-100/50 dark:border-white/5 shadow-xl bg-gradient-to-br from-indigo-500/[0.02] to-transparent">
          <h3 className="text-base font-medium text-dark-900 dark:text-white mb-8 flex items-center gap-2">
             <BarChart3 className="w-5 h-5 text-indigo-500" /> Key Constituency Issues
          </h3>
          <div className="space-y-5">
            {stats.stats.top_issues?.slice(0, 5).map((issue, i) => (
              <div key={i} className="relative">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[11px] font-bold text-dark-700 dark:text-dark-300 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> {issue.name}
                  </span>
                  <span className="text-[10px] font-black text-indigo-500">{issue.count} REF</span>
                </div>
                <div className="h-1.5 bg-dark-100 dark:bg-dark-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-indigo-600 to-blue-400 rounded-full transition-all duration-1000"
                    style={{ width: `${(parseInt(issue.count) / Math.max(...(stats.stats.top_issues?.map(it => parseInt(it.count)) || [1]))) * 100}%` }} 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card overflow-hidden">
          <div className="p-6 border-b border-dark-100 dark:border-white/5 flex items-center justify-between">
            <h3 className="text-base font-medium text-dark-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-500" /> Field Performance
            </h3>
            <span className="text-[10px] font-bold text-dark-500 uppercase tracking-widest">Top Contributors</span>
          </div>
          <div className="p-4 space-y-2">
            {stats.lists.top_performers?.map((worker, i) => (
              <div key={worker.name} className="flex items-center justify-between p-3 rounded-xl hover:bg-dark-50 dark:hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-dark-100 dark:bg-dark-800 flex items-center justify-center text-xs font-medium text-dark-500 dark:text-dark-400">{i + 1}</div>
                  <div className="text-sm font-medium text-dark-800 dark:text-dark-100">{worker.name}</div>
                </div>
                <div className="text-[11px] font-medium text-green-600 dark:text-green-400 capitalize bg-green-500/10 px-3 py-1 rounded-full">{worker.surveys_count} Surveys</div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-6 flex flex-col bg-gradient-to-br from-saffron-500/[0.03] to-transparent border border-saffron-500/10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-saffron-500/10 flex items-center justify-center">
              <Target className="w-5 h-5 text-saffron-500" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-dark-900 dark:text-white uppercase tracking-wider leading-none">Constituency Target</h4>
              <p className="text-[10px] text-dark-500 mt-1 uppercase tracking-widest">Election Goal 2026</p>
            </div>
          </div>
          
          <div className="space-y-6 flex-grow flex flex-col justify-center">
             <div>
                <div className="flex justify-between items-end mb-3">
                   <span className="text-xs font-bold text-dark-600 dark:text-dark-400 uppercase tracking-[2px]">Booth Penetration</span>
                   <span className="text-lg font-black text-saffron-500">65%</span>
                </div>
                <div className="h-4 bg-dark-100 dark:bg-dark-800/50 rounded-full overflow-hidden p-[3px] border border-dark-200 dark:border-white/5">
                   <div className="bg-gradient-to-r from-saffron-600 to-amber-400 h-full w-[65%] rounded-full shadow-[0_0_15px_rgba(249,115,22,0.4)]" />
                </div>
             </div>

             <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-white/50 dark:bg-white/5 border border-dark-100 dark:border-white/5">
                   <div className="text-[10px] font-bold text-dark-500 uppercase tracking-widest mb-1">Target Voters</div>
                   <div className="text-xl font-black text-dark-900 dark:text-white">14.2K</div>
                </div>
                <div className="p-4 rounded-2xl bg-white/50 dark:bg-white/5 border border-dark-100 dark:border-white/5">
                   <div className="text-[10px] font-bold text-dark-500 uppercase tracking-widest mb-1">Reach Gap</div>
                   <div className="text-xl font-black text-red-500">-4.8K</div>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
