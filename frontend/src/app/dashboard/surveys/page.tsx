'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { surveysAPI } from '@/lib/api';
import { Survey } from '@/types';
import { Plus, Search, Trash2, X, Loader2, ClipboardList, BarChart3 } from 'lucide-react';
import Modal from '@/components/Modal';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function SurveysPage() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [view, setView] = useState<'list' | 'analytics'>('list');
  const [supportFilter, setSupportFilter] = useState('');
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });

  const [form, setForm] = useState({
    support_status: 'neutral', satisfaction_level: '3', remarks: '',
  });

  useEffect(() => { loadSurveys(); loadStats(); }, [supportFilter]);

  const loadSurveys = async (page = 1) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (supportFilter) params.support_status = supportFilter;
      const res = await surveysAPI.getAll(params);
      setSurveys(res.data.data);
      setMeta(res.data.meta);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadStats = async () => {
    try { const res = await surveysAPI.getStats(); setStats(res.data.data); } catch {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await surveysAPI.create({
        ...form, satisfaction_level: parseInt(form.satisfaction_level),
      });
      setShowModal(false);
      loadSurveys();
      loadStats();
    } catch (err: any) { alert(err.response?.data?.message || 'Error'); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this survey?')) return;
    try { await surveysAPI.delete(id); loadSurveys(); loadStats(); } catch {}
  };

  const supportBadge = (s: string) => {
    switch(s) { case 'supporter': return 'badge-success'; case 'neutral': return 'badge-warning'; case 'opponent': return 'badge-danger'; default: return 'badge-neutral'; }
  };

  return (
    <>
      <Header title="Survey Module" subtitle="Voter sentiment tracking and analysis" />
      <div className="p-8">
        {/* View Toggle */}
        <div className="flex items-center justify-between mb-6">
          <div className="tabs-toggle">
            <button onClick={() => setView('list')} className={`tabs-toggle-item ${view === 'list' ? 'tabs-toggle-item-active' : 'tabs-toggle-item-inactive'}`}>
              <ClipboardList className="w-4 h-4" />List
            </button>
            <button onClick={() => setView('analytics')} className={`tabs-toggle-item ${view === 'analytics' ? 'tabs-toggle-item-active' : 'tabs-toggle-item-inactive'}`}>
              <BarChart3 className="w-4 h-4" />Analytics
            </button>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary"><Plus className="w-4 h-4" /> New Survey</button>
        </div>

        {view === 'analytics' && stats ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Support Breakdown */}
            <div className="glass-card p-6">
              <h3 className="text-base font-bold mb-4">Support Breakdown</h3>
              <div className="h-64 flex items-center justify-center">
                <Doughnut
                  data={{
                    labels: stats.support_breakdown.map((s: any) => s.support_status),
                    datasets: [{
                      data: stats.support_breakdown.map((s: any) => parseInt(s.count)),
                      backgroundColor: ['#22c55e', '#f59e0b', '#ef4444', '#64748b'],
                      borderWidth: 0,
                    }],
                  }}
                  options={{ responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } } }}
                />
              </div>
            </div>
            {/* Top Issues */}
            <div className="glass-card p-6">
              <h3 className="text-base font-bold mb-4">Top Issues Reported</h3>
              <div className="space-y-3">
                {stats.top_issues.map((issue: any, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-dark-700 dark:text-dark-300 font-medium">{issue.issue}</span>
                        <span className="font-bold text-dark-900 dark:text-dark-200">{issue.count}</span>
                      </div>
                      <div className="h-1.5 bg-dark-800 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-saffron-500 to-saffron-400 rounded-full"
                          style={{ width: `${(parseInt(issue.count) / Math.max(parseInt(stats.top_issues[0]?.count || '1'), 1)) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
                {stats.top_issues.length === 0 && <p className="text-dark-500 text-sm">No issues reported yet</p>}
              </div>
            </div>
            {/* Stats Cards */}
            <div className="glass-card p-6 lg:col-span-2">
              <h3 className="text-base font-bold mb-4">Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-dark-50 dark:bg-dark-800/40 rounded-lg p-4 text-center border border-dark-100 dark:border-white/5">
                  <div className="text-2xl font-extrabold text-dark-900 dark:text-dark-100">{stats.total}</div>
                  <div className="text-xs font-bold text-dark-500 mt-1 uppercase tracking-wider">Total Surveys</div>
                </div>
                {stats.support_breakdown.map((s: any) => (
                  <div key={s.support_status} className="bg-dark-50 dark:bg-dark-800/40 rounded-lg p-4 text-center border border-dark-100 dark:border-white/5">
                    <div className="text-2xl font-extrabold text-dark-900 dark:text-dark-100">{s.count}</div>
                    <div className="text-xs font-bold text-dark-500 mt-1 capitalize uppercase tracking-wider">{s.support_status} ({s.percentage}%)</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-6">
              {['', 'supporter', 'neutral', 'opponent'].map(s => (
                <button key={s} onClick={() => setSupportFilter(s)}
                  className={`filter-tab ${supportFilter === s ? 'active' : ''}`}>
                  {s ? s : 'All'}
                </button>
              ))}
            </div>

            {/* Survey List */}
            <div className="glass-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr><th>Voter</th><th>Surveyor</th><th>Support</th><th>Satisfaction</th><th>Booth</th><th>Issues</th><th>Date</th><th className="text-right">Actions</th></tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={8} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-saffron-400" /></td></tr>
                    ) : surveys.length === 0 ? (
                      <tr><td colSpan={8} className="text-center py-12 text-dark-500">No surveys found</td></tr>
                    ) : (
                      surveys.map(survey => (
                        <tr key={survey.id}>
                          <td className="font-bold text-dark-900 dark:text-dark-100">{survey.voter_name || 'Anonymous'}</td>
                          <td className="text-dark-700 dark:text-dark-400 font-medium">{survey.surveyor_name || '—'}</td>
                          <td><span className={`badge ${supportBadge(survey.support_status)} capitalize`}>{survey.support_status}</span></td>
                          <td>
                            <div className="flex gap-0.5">
                              {[1,2,3,4,5].map(n => (
                                <span key={n} className={`text-sm ${n <= (survey.satisfaction_level || 0) ? 'text-yellow-400' : 'text-dark-700'}`}>★</span>
                              ))}
                            </div>
                          </td>
                          <td className="text-dark-800 dark:text-dark-400 font-bold">{survey.booth_name || '—'}</td>
                          <td className="text-dark-400 text-xs">
                            {survey.issues && survey.issues.length > 0 
                              ? survey.issues.map(i => i.issue_name).join(', ')
                              : '—'}
                          </td>
                          <td className="text-[11px] font-bold text-dark-600 dark:text-dark-500 uppercase tracking-tighter">{new Date(survey.created_at).toLocaleDateString()}</td>
                          <td className="text-right">
                            <button onClick={() => handleDelete(survey.id)} className="btn-icon bg-red-500/10 border border-red-500/20 text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Record New Survey"
        subtitle="Capture voter sentiment and tactical feedback from the field"
        maxWidth="max-w-[600px]"
        footer={(
          <>
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary min-w-[120px]">Cancel</button>
            <button type="submit" form="survey-form" className="btn-primary min-w-[180px]">
              Submit Survey
            </button>
          </>
        )}
      >
        <form id="survey-form" onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Support Status *</label>
              <select value={form.support_status} onChange={e => setForm({...form, support_status: e.target.value})} className="form-input" required>
                <option value="supporter">Supporter</option>
                <option value="neutral">Neutral</option>
                <option value="opponent">Opponent</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Satisfaction Level (1-5)</label>
              <select value={form.satisfaction_level} onChange={e => setForm({...form, satisfaction_level: e.target.value})} className="form-input">
                {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} Star{n > 1 ? 's' : ''}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Detailed Remarks & Feedback</label>
            <textarea value={form.remarks} onChange={e => setForm({...form, remarks: e.target.value})} className="form-input h-32 resize-none" placeholder="Provide detailed tactical observations or voter concerns..." />
          </div>
        </form>
      </Modal>
    </>
  );
}
