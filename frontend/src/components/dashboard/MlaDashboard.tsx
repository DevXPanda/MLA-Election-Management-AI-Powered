'use client';

import React from 'react';
import { Vote, Target, ShieldAlert, Activity, Map as MapIcon, TrendingUp, HelpCircle } from 'lucide-react';
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
      backgroundColor: ['#22c55e', '#f59e0b', '#ef4444'],
      borderWidth: 0,
    }],
  };

  const issuesData = {
    labels: top_issues?.map(i => i.name) || [],
    datasets: [{
      label: 'Reported Counts',
      data: top_issues?.map(i => parseInt(i.count)) || [],
      backgroundColor: 'rgba(249, 115, 22, 0.4)',
      borderColor: '#f97316',
      borderWidth: 1,
      borderRadius: 4,
    }],
  };

  const surveyTrendData = {
    labels: stats.charts.survey_trend?.map((s) => format(new Date(s.date), 'dd MMM')) || [],
    datasets: [{
      label: 'Constituency Surveys',
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
    <div className="p-8 pb-12">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-5 mb-8">
        {statCards.map((card) => (
          <div key={card.label} className="glass-card-hover p-5 relative overflow-hidden group">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.bgIcon} mb-4`}>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <div className="text-2xl font-black text-dark-900 dark:text-dark-100">{card.value}</div>
            <div className="text-[10px] text-dark-600 dark:text-dark-500 font-bold uppercase tracking-widest mt-1 tracking-[1.5px]">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="glass-card p-6">
          <h3 className="text-base font-black text-dark-900 dark:text-white mb-6 flex items-center gap-2">
            <MapIcon className="w-5 h-5 text-saffron-500" /> Booth Strength
          </h3>
          <div className="h-[220px]">
            <Doughnut data={boothStrengthData} options={{ ...chartDefaults, cutout: '75%' }} />
          </div>
          <div className="mt-8 space-y-4">
            <div className="flex justify-between items-center bg-green-500/5 p-3 rounded-lg border border-green-500/10">
              <span className="text-[10px] font-black text-green-600 dark:text-green-400 uppercase tracking-widest">Strong (&gt;60%)</span>
              <span className="text-sm font-black text-dark-900 dark:text-white">{booth_strength?.strong_booths || 0}</span>
            </div>
            <div className="flex justify-between items-center bg-amber-500/5 p-3 rounded-lg border border-amber-500/10">
              <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">Competitive (40-60)</span>
              <span className="text-sm font-black text-dark-900 dark:text-white">{booth_strength?.competitive_booths || 0}</span>
            </div>
            <div className="flex justify-between items-center bg-red-500/5 p-3 rounded-lg border border-red-500/10">
              <span className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest">Weak (&lt;40%)</span>
              <span className="text-sm font-black text-dark-900 dark:text-white">{booth_strength?.weak_booths || 0}</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card p-6 h-1/2 min-h-[250px]">
            <h3 className="text-base font-black text-dark-900 dark:text-white mb-6 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-blue-500" /> Top Issues
            </h3>
            <div className="h-[180px]">
              <Bar
                data={issuesData}
                options={{
                  ...chartDefaults,
                  indexAxis: 'y',
                  scales: {
                    x: { display: false },
                    y: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 10, weight: 'bold' } } }
                  }
                }}
              />
            </div>
          </div>

          <div className="glass-card p-6 h-1/2 min-h-[250px]">
            <h3 className="text-base font-black text-dark-900 dark:text-white mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" /> Ground Momentum
            </h3>
            <div className="h-[180px]">
              <Line data={surveyTrendData} options={chartDefaults} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
