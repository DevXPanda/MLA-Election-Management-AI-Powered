'use client';

import { useState, useEffect, useMemo } from 'react';
import Header from '@/components/Header';
import { dashboardAPI, surveysAPI, votersAPI } from '@/lib/api';
import { BarChart3, TrendingUp, Users, Vote, Activity, Target, PieChart } from 'lucide-react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import { MODULE_HEADER } from '@/lib/ui-labels';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler);

export default function ReportsPage() {
  const [dashStats, setDashStats] = useState<any>(null);
  const [surveyStats, setSurveyStats] = useState<any>(null);
  const [voterStats, setVoterStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [dash, survey, voter] = await Promise.allSettled([
        dashboardAPI.getStats(),
        surveysAPI.getStats(),
        votersAPI.getStats(),
      ]);
      if (dash.status === 'fulfilled') setDashStats(dash.value.data.data);
      if (survey.status === 'fulfilled') setSurveyStats(survey.value.data.data);
      if (voter.status === 'fulfilled') setVoterStats(voter.value.data.data);
    } catch {} finally { setLoading(false); }
  };

  const chartOpts = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#f1f5f9',
        bodyColor: '#94a3b8',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        padding: 14,
        cornerRadius: 16,
        usePointStyle: true,
        titleFont: { size: 13, weight: 700 },
        boxPadding: 8,
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#64748b', font: { size: 11, weight: 400, family: 'Inter' } },
        border: { display: false }
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.03)', drawTicks: false },
        ticks: { color: '#64748b', font: { size: 11, weight: 400 }, padding: 10 },
        border: { display: false }
      }
    },
  }), []);

  if (loading) return (
    <>
      <Header title={MODULE_HEADER.reports.title} subtitle={MODULE_HEADER.reports.subtitle} />
      <div className="p-8 flex justify-center py-20"><div className="w-8 h-8 border-[3px] border-dark-700 border-t-saffron-500 rounded-full animate-spin" /></div>
    </>
  );

  return (
    <>
      <Header title={MODULE_HEADER.reports.title} subtitle={MODULE_HEADER.reports.subtitle} />
      <div className="p-8">
        {/* Summary Cards */}
        {dashStats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            {[
              { label: 'Total Voters', value: dashStats.stats?.total_voters || 0, icon: Vote, color: 'bg-blue-500/12 text-blue-400' },
              { label: 'Surveys Done', value: dashStats.stats?.total_surveys || 0, icon: BarChart3, color: 'bg-green-500/12 text-green-400' },
              { label: 'Active Workers', value: dashStats.stats?.active_workers || 0, icon: Users, color: 'bg-saffron-500/12 text-saffron-400' },
              { label: 'Tasks Complete', value: dashStats.stats?.total_tasks || 0, icon: TrendingUp, color: 'bg-purple-500/12 text-purple-400' },
            ].map(c => {
              const Icon = c.icon;
              return (
                <div key={c.label} className="glass-card-hover p-6">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${c.color}`}><Icon className="w-5 h-5" /></div>
                  <div className="text-2xl font-extrabold text-dark-900 dark:text-dark-100">{Number(c.value).toLocaleString()}</div>
                  <div className="text-xs text-dark-500 mt-1 uppercase tracking-wider font-bold">{c.label}</div>
                </div>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Survey Trend */}
          {dashStats?.charts?.survey_trend && (
            <div className="glass-card p-6 border border-dark-100/50 dark:border-white/5 shadow-xl">
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-medium text-dark-900 dark:text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-saffron-500" /> Survey Collection Trend
                  </h3>
                  <p className="text-[11px] text-dark-500 font-medium uppercase tracking-wider mt-1 opacity-70">Active Field Intelligence</p>
                </div>
                <div className="px-3 py-1 rounded-full bg-saffron-500/10 text-saffron-500 text-[10px] font-bold uppercase tracking-widest">Live</div>
              </div>
              <div className="h-[280px]">
                <Line data={{
                  labels: dashStats.charts.survey_trend.map((s: any) => new Date(s.date).toLocaleDateString('en', { day: '2-digit', month: 'short' })),
                  datasets: [{
                    data: dashStats.charts.survey_trend.map((s: any) => parseInt(s.count)),
                    borderColor: '#f97316',
                    backgroundColor: 'rgba(249, 115, 22, 0.12)',
                    fill: true,
                    tension: 0.35,
                    pointRadius: 3,
                    pointBackgroundColor: '#f97316',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    borderWidth: 3,
                  }],
                }} options={chartOpts} />
              </div>
            </div>
          )}

          {/* Support Sentiment */}
          {voterStats?.support_breakdown && (
            <div className="glass-card p-6 border border-dark-100/50 dark:border-white/5 shadow-xl">
              <div className="mb-8">
                <h3 className="text-base font-medium text-dark-900 dark:text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-500" /> Voter Sentiment Analysis
                </h3>
                <p className="text-[11px] text-dark-500 font-medium uppercase tracking-wider mt-1 opacity-70">Cumulative Political Standing</p>
              </div>
              <div className="h-[240px] flex items-center justify-center">
                <Doughnut data={{
                  labels: voterStats.support_breakdown.map((s: any) => s.support_status.toUpperCase()),
                  datasets: [{
                    data: voterStats.support_breakdown.map((s: any) => parseInt(s.count)),
                    backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#64748b'],
                    borderWidth: 0,
                  }],
                }} options={{ ...chartOpts, cutout: '78%' }} />
              </div>
              <div className="flex flex-wrap gap-2 mt-6 justify-center">
                {voterStats.support_breakdown.map((s: any, i: number) => (
                  <div key={i} className="px-3 py-1.5 rounded-lg bg-dark-50 dark:bg-dark-800/60 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider border border-dark-100 dark:border-transparent">
                    <span className={`w-1.5 h-1.5 rounded-full ${['bg-green-500', 'bg-amber-500', 'bg-red-500', 'bg-dark-500'][i % 4]}`} />
                    <span className="text-dark-600 dark:text-dark-400">{s.support_status}: {s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Geographic Coverage */}
          {voterStats?.by_ward && (
             <div className="glass-card p-6 border border-dark-100/50 dark:border-white/5 shadow-xl">
               <div className="mb-8">
                 <h3 className="text-base font-medium text-dark-900 dark:text-white flex items-center gap-2">
                   <Target className="w-5 h-5 text-indigo-500" /> Geographic Coverage
                 </h3>
                 <p className="text-[11px] text-dark-500 font-medium uppercase tracking-wider mt-1 opacity-70">Booth-wise Voter Density</p>
               </div>
               <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                 {voterStats.by_ward.map((w: any, idx: number) => (
                   <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-dark-50/50 dark:bg-white/[0.02] border border-dark-100/50 dark:border-white/5">
                     <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-[10px] font-bold text-indigo-500">B-{idx+1}</div>
                        <span className="text-xs font-bold text-dark-800 dark:text-dark-100 uppercase tracking-wider">{w.ward_name}</span>
                     </div>
                     <span className="text-xs font-black text-indigo-400">{w.count} VOTERS</span>
                   </div>
                 ))}
               </div>
             </div>
          )}

          {/* Scheme Beneficiary Analytics */}
          {voterStats && (
            <div className="glass-card p-6 mb-8 border border-dark-100/50 dark:border-white/5 shadow-xl bg-gradient-to-br from-emerald-500/[0.02] to-transparent flex flex-col justify-center">
              <h3 className="text-base font-bold text-dark-900 dark:text-white flex items-center gap-3 mb-4">
                <Users className="w-6 h-6 text-emerald-500" /> Welfare Outreach
              </h3>
              <p className="text-xs text-dark-500 uppercase tracking-widest font-medium leading-relaxed mb-6">
                Tracking beneficiaries across various government schemes and localized impact.
              </p>
              <div className="space-y-4">
                 <div className="p-5 rounded-2xl bg-white/40 dark:bg-white/5 border border-dark-100 dark:border-white/5 flex justify-between items-center">
                    <div>
                      <div className="text-[10px] font-black text-dark-500 uppercase tracking-widest mb-1">Total Beneficiaries</div>
                      <div className="text-2xl font-black text-dark-900 dark:text-white">{voterStats.scheme_beneficiaries || 0}</div>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                      <Users className="w-5 h-5 text-emerald-500" />
                    </div>
                 </div>
                 <div className="p-5 rounded-2xl bg-white/40 dark:bg-white/5 border border-dark-100 dark:border-white/5">
                    <div className="text-[10px] font-black text-dark-500 uppercase tracking-widest mb-1">Scheme Coverage</div>
                    <div className="text-xl font-black text-dark-900 dark:text-white">{Math.round((voterStats.scheme_beneficiaries / (voterStats.total || 1)) * 100) || 0}% Reach</div>
                    <div className="h-1.5 bg-dark-100 dark:bg-dark-800 rounded-full mt-3 overflow-hidden">
                       <div className="h-full bg-blue-500" style={{ width: `${(voterStats.scheme_beneficiaries / (voterStats.total || 1)) * 100}%` }} />
                    </div>
                 </div>
              </div>
            </div>
          )}
        </div>

        {/* Top Issues Matrix */}
        {dashStats?.stats?.top_issues && dashStats.stats.top_issues.length > 0 && (
          <div className="glass-card p-8 mb-8 border border-dark-100/50 dark:border-white/5 shadow-2xl relative overflow-hidden">
            <div className="mb-10 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-dark-900 dark:text-white flex items-center gap-3 text-shadow-sm">
                  <BarChart3 className="w-6 h-6 text-saffron-500" /> Strategic Priority Matrix
                </h3>
                <p className="text-xs text-dark-500 font-medium uppercase tracking-[3px] mt-2 opacity-80">Major Public Constraints Index</p>
              </div>
              <div className="px-4 py-1.5 rounded-full border border-dark-100 dark:border-white/5 bg-dark-50/50 dark:bg-white/5 text-[10px] font-bold text-dark-500 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> CRITICAL
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {dashStats.stats.top_issues.map((i: any, idx: number) => (
                <div key={idx} className="glass-card-hover p-5 border border-dark-100 dark:border-white/5 relative overflow-hidden group bg-gradient-to-br from-indigo-500/[0.02] to-transparent">
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-6">
                       <span className="w-8 h-8 rounded-lg bg-saffron-500/10 text-saffron-500 flex items-center justify-center text-xs font-black border border-saffron-500/20">{idx + 1}</span>
                       <span className={`px-2 py-0.5 rounded text-[9px] font-black tracking-widest uppercase ${parseInt(i.count) > 5 ? "bg-red-500/10 text-red-500" : "bg-emerald-500/10 text-emerald-500"}`}>
                         {parseInt(i.count) > 5 ? "Immediate Action" : "Monitoring"}
                       </span>
                    </div>
                    <div className="text-sm font-black text-dark-900 dark:text-dark-100 mb-2 uppercase tracking-wide truncate pr-8">{i.name}</div>
                    <div className="flex items-center gap-2 mb-4">
                       <Activity className="w-3.5 h-3.5 text-dark-400" /> 
                       <span className="text-[11px] font-bold text-dark-500 uppercase tracking-wider">{i.count} Verified Reports</span>
                    </div>
                    <div className="h-1.5 bg-dark-100 dark:bg-dark-800 rounded-full overflow-hidden">
                       <div 
                         className="h-full bg-gradient-to-r from-saffron-500 to-amber-400 rounded-full shadow-[0_0_8px_rgba(249,115,22,0.3)] transition-all duration-1000"
                         style={{ width: `${Math.min((parseInt(i.count) / (Math.max(...dashStats.stats.top_issues.map((it:any)=>parseInt(it.count))) || 1)) * 100, 100)}%` }}
                       />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Voter Demographics */}
        {voterStats && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-card p-6 border border-dark-100/50 dark:border-white/5 shadow-xl">
              <div className="mb-8">
                <h3 className="text-base font-medium text-dark-900 dark:text-white flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-blue-500" /> Gender Distribution
                </h3>
                <p className="text-[11px] text-dark-500 font-medium uppercase tracking-wider mt-1 opacity-70">Democratic Composition</p>
              </div>
              <div className="h-[240px] flex items-center justify-center relative">
                <Doughnut data={{
                  labels: voterStats.gender_breakdown?.map((g: any) => g.gender?.toUpperCase() || 'UNKNOWN') || [],
                  datasets: [{
                    data: voterStats.gender_breakdown?.map((g: any) => parseInt(g.count)) || [],
                    backgroundColor: ['#3b82f6', '#ec4899', '#64748b'],
                    borderWidth: 0,
                  }],
                }} options={{ ...chartOpts, cutout: '78%' }} />
              </div>
              <div className="flex flex-wrap gap-3 mt-8 justify-center">
                {voterStats.gender_breakdown?.map((g: any, i: number) => (
                  <div key={i} className="px-4 py-2 rounded-xl bg-dark-50 dark:bg-dark-800/40 flex items-center gap-3 border border-dark-100 dark:border-white/5 backdrop-blur-md">
                    <span className={`w-2.5 h-2.5 rounded-full ${['bg-blue-500', 'bg-pink-500', 'bg-slate-500'][i % 3]}`} />
                    <span className="text-[11px] font-bold text-dark-700 dark:text-dark-300 uppercase tracking-widest">{g.gender || 'Unknown'}: {g.count}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="glass-card p-6 border border-dark-100/50 dark:border-white/5 shadow-xl">
              <div className="mb-8">
                <h3 className="text-base font-medium text-dark-900 dark:text-white flex items-center gap-2">
                  <Target className="w-5 h-5 text-purple-500" /> Caste Composition
                </h3>
                <p className="text-[11px] text-dark-500 font-medium uppercase tracking-wider mt-1 opacity-70">Major Social Demographics</p>
              </div>
              <div className="space-y-5 max-h-[340px] overflow-y-auto pr-3 custom-scrollbar">
                {voterStats.caste_breakdown?.slice(0, 10).map((c: any, i: number) => (
                  <div key={i} className="group cursor-default">
                    <div className="flex justify-between text-[11px] font-black uppercase tracking-[1.5px] mb-2.5">
                      <span className="text-dark-600 dark:text-dark-400 group-hover:text-saffron-500 transition-colors flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-saffron-500/40" /> {c.caste || 'Unknown'}
                      </span>
                      <span className="text-dark-900 dark:text-white bg-dark-50 dark:bg-dark-800 px-2 py-0.5 rounded-md border border-dark-100 dark:border-white/5">{c.count}</span>
                    </div>
                    <div className="h-2 bg-dark-100 dark:bg-dark-800 rounded-full overflow-hidden p-[1px]">
                      <div 
                        className="h-full bg-gradient-to-r from-saffron-600 to-amber-400 rounded-full transition-all duration-[1s] group-hover:shadow-[0_0_10px_rgba(249,115,22,0.3)]"
                        style={{ width: `${(parseInt(c.count) / Math.max(parseInt(voterStats.caste_breakdown?.[0]?.count || '1'), 1)) * 100}%` }} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
