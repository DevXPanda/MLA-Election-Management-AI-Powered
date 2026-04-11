'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { dashboardAPI, surveysAPI, votersAPI } from '@/lib/api';
import { BarChart3, TrendingUp, Users, Vote, Download } from 'lucide-react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
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

  const chartOpts: any = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e293b', titleColor: '#f1f5f9', bodyColor: '#94a3b8', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, padding: 12, cornerRadius: 8 } },
    scales: { x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#64748b' }, border: { display: false } }, y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#64748b' }, border: { display: false } } },
  };

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
              { label: 'Total Voters', value: dashStats.counts?.total_voters || 0, icon: Vote, color: 'bg-blue-500/12 text-blue-400' },
              { label: 'Surveys Done', value: dashStats.counts?.total_surveys || 0, icon: BarChart3, color: 'bg-green-500/12 text-green-400' },
              { label: 'Active Workers', value: dashStats.counts?.active_workers || 0, icon: Users, color: 'bg-saffron-500/12 text-saffron-400' },
              { label: 'Tasks Complete', value: dashStats.task_stats?.find((t: any) => t.status === 'completed')?.count || 0, icon: TrendingUp, color: 'bg-purple-500/12 text-purple-400' },
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
          {dashStats?.survey_trend && (
            <div className="glass-card">
              <div className="p-6 border-b border-white/5">
                <h3 className="font-bold">Survey Collection Trend</h3>
                <p className="text-xs text-dark-500 mt-1">Last 7 days</p>
              </div>
              <div className="p-6 h-[300px]">
                <Line data={{
                  labels: (dashStats.survey_trend || []).map((s: any) => new Date(s.date).toLocaleDateString('en', { day: '2-digit', month: 'short' })),
                  datasets: [{
                    data: (dashStats.survey_trend || []).map((s: any) => parseInt(s.count)),
                    borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,0.1)',
                    fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#f97316', borderWidth: 2,
                  }],
                }} options={chartOpts} />
              </div>
            </div>
          )}

          {/* Support Sentiment */}
          {surveyStats && (
            <div className="glass-card">
              <div className="p-6 border-b border-white/5">
                <h3 className="font-bold">Voter Sentiment Analysis</h3>
              </div>
              <div className="p-6 h-[300px] flex items-center justify-center">
                <Doughnut data={{
                  labels: surveyStats.support_breakdown.map((s: any) => s.support_status),
                  datasets: [{
                    data: surveyStats.support_breakdown.map((s: any) => parseInt(s.count)),
                    backgroundColor: ['#22c55e', '#f59e0b', '#ef4444', '#64748b'], borderWidth: 0,
                  }],
                }} options={{ responsive: true, maintainAspectRatio: false, cutout: '72%', plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 20 } } } }} />
              </div>
            </div>
          )}
        </div>

        {/* Top Issues */}
        {surveyStats?.top_issues && surveyStats.top_issues.length > 0 && (
          <div className="glass-card mb-6">
            <div className="p-6 border-b border-white/5">
              <h3 className="font-bold">Key Issues – Priority Matrix</h3>
            </div>
            <div className="p-6 h-[300px]">
              <Bar data={{
                labels: surveyStats.top_issues.map((i: any) => i.issue),
                datasets: [{
                  data: surveyStats.top_issues.map((i: any) => parseInt(i.count)),
                  backgroundColor: 'rgba(249, 115, 22, 0.7)', borderRadius: 6,
                }],
              }} options={{...chartOpts, indexAxis: 'y' as const}} />
            </div>
          </div>
        )}

        {/* Voter Demographics */}
        {voterStats && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-card">
              <div className="p-6 border-b border-white/5"><h3 className="font-bold">Gender Distribution</h3></div>
              <div className="p-6 h-[260px] flex items-center justify-center">
                <Doughnut data={{
                  labels: voterStats.gender_breakdown?.map((g: any) => g.gender || 'Unknown') || [],
                  datasets: [{
                    data: voterStats.gender_breakdown?.map((g: any) => parseInt(g.count)) || [],
                    backgroundColor: ['#3b82f6', '#ec4899', '#64748b'], borderWidth: 0,
                  }],
                }} options={{ responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } } }} />
              </div>
            </div>
            <div className="glass-card">
              <div className="p-6 border-b border-white/5"><h3 className="font-bold">Caste Composition</h3></div>
              <div className="p-6">
                <div className="space-y-3">
                  {voterStats.caste_breakdown?.slice(0, 8).map((c: any, i: number) => (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-dark-300">{c.caste || 'Unknown'}</span>
                        <span className="font-bold text-dark-200">{c.count}</span>
                      </div>
                      <div className="h-1.5 bg-dark-800 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-saffron-500 to-saffron-400 rounded-full"
                          style={{ width: `${(parseInt(c.count) / Math.max(parseInt(voterStats.caste_breakdown?.[0]?.count || '1'), 1)) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
