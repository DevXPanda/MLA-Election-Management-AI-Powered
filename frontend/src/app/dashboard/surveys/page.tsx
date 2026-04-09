'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { showToast } from '@/lib/toast';
import Header from '@/components/Header';
import { surveysAPI } from '@/lib/api';
import { Survey } from '@/types';
import {
  Plus, Search, Trash2, X, Loader2, ClipboardList,
  BarChart3, Camera, Circle, XCircle, RefreshCw,
  Activity, HelpCircle, Heart, Users
} from 'lucide-react';
import Modal from '@/components/Modal';
import StatsSummary from '@/components/dashboard/StatsSummary';
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
    image_url: ''
  });

  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (isCameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [isCameraActive]);

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
    try { const res = await surveysAPI.getStats(); setStats(res.data.data); } catch { }
  };

  const startTacticalCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      setIsCameraActive(true);
    } catch (err) {
      showToast.error("Capture access denied. Check permissions.");
    }
  };

  const stopTacticalCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const captureTacticalPhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setForm(prev => ({ ...prev, image_url: dataUrl }));
    stopTacticalCamera();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await surveysAPI.create({
        ...form, satisfaction_level: parseInt(form.satisfaction_level),
      });
      setShowModal(false);
      setForm({ support_status: 'neutral', satisfaction_level: '3', remarks: '', image_url: '' });
      loadSurveys();
      loadStats();
    } catch (err: any) {
      showToast.error(err.response?.data?.message || 'Error saving survey');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    showToast.confirm(
      'Delete Survey',
      'Are you sure you want to delete this survey entry? This data will be permanently removed from analytics.',
      async () => {
        try { 
          await surveysAPI.delete(id); 
          loadSurveys(); 
          loadStats(); 
          toast.success('Survey deleted');
        } catch (err) {
          showToast.error('Failed to delete survey');
        }
      },
      'Delete'
    );
  };

  const supportBadge = (s: string) => {
    switch (s) { case 'supporter': return 'badge-success'; case 'neutral': return 'badge-warning'; case 'opponent': return 'badge-danger'; default: return 'badge-neutral'; }
  };

  return (
    <>
      <Header title="Survey Module" subtitle="Voter sentiment tracking and analysis" />
      <div className="dashboard-container">
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

        {/* Global Summary Stats */}
        <StatsSummary
          loading={loading && !stats}
          stats={[
            { label: 'Total Surveys', value: stats?.total || 0, icon: Activity, color: 'text-purple-500', bgIcon: 'bg-purple-500/10' },
            { label: 'Supportive', value: stats?.support_breakdown?.find((s: any) => s.support_status === 'supporter')?.count || 0, icon: Heart, color: 'text-emerald-500', bgIcon: 'bg-emerald-500/10' },
            { label: 'Issues Found', value: stats?.top_issues?.length || 0, icon: HelpCircle, color: 'text-amber-500', bgIcon: 'bg-amber-500/10' },
            { label: 'Avg Rating', value: stats?.satisfaction_stats?.average_rating || '0.0', icon: RefreshCw, color: 'text-blue-500', bgIcon: 'bg-blue-500/10' },
          ]}
        />

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
            {/* Empty column or spacer if needed */}
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
                    <tr><th>Voter</th><th>Surveyor</th><th>Support</th><th>Satisfaction</th><th>Booth</th><th>Survey Name</th><th>Date</th><th className="text-right">Actions</th></tr>
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
                              {[1, 2, 3, 4, 5].map(n => (
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
        onClose={() => { stopTacticalCamera(); setShowModal(false); }}
        title="Record New Survey"
        subtitle="Capture voter sentiment and tactical feedback from the field"
        maxWidth="max-w-[900px]"
        footer={(
          <div className="flex gap-3 w-full sm:w-auto ml-auto">
            <button type="button" onClick={() => { stopTacticalCamera(); setShowModal(false); }} className="btn-secondary px-8">Cancel</button>
            <button type="submit" form="survey-form" className="btn-primary px-12">Submit Survey</button>
          </div>
        )}
      >
        <form id="survey-form" onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* Left: Tactical Proof */}
            <div className="space-y-4">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-[0.2em] px-1">Voter/ID Proof (Mandatory)</label>
              <div className="relative aspect-video rounded-2xl border-2 border-dashed border-dark-200 dark:border-white/10 overflow-hidden bg-dark-50/50 flex flex-col items-center justify-center group">
                {isCameraActive ? (
                  <div className="absolute inset-0 z-20">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    <div className="absolute inset-x-0 bottom-4 flex justify-center gap-4">
                      <button type="button" onClick={captureTacticalPhoto} className="btn-primary size-12 rounded-full p-0 flex items-center justify-center animate-pulse shadow-lg shadow-saffron-500/20">
                        <Circle className="w-7 h-7 fill-white" />
                      </button>
                      <button type="button" onClick={stopTacticalCamera} className="bg-red-500/80 backdrop-blur-md text-white p-3 rounded-full shadow-lg active:scale-95 transition-transform">
                        <XCircle className="w-6 h-6" />
                      </button>
                    </div>
                  </div>
                ) : form.image_url ? (
                  <>
                    {loading && (
                      <div className="absolute inset-0 bg-dark-900/60 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                        <Loader2 className="w-8 h-8 animate-spin text-saffron-500 mb-2" />
                        <span className="text-[10px] font-black text-white uppercase tracking-tighter">Processing...</span>
                      </div>
                    )}
                    <img src={form.image_url} className="w-full h-full object-cover" />
                    <div className="absolute top-3 right-3 z-10">
                      <button type="button" onClick={() => { setForm(p => ({ ...p, image_url: '' })); startTacticalCamera(); }} className="bg-saffron-500 text-white p-2 rounded-xl shadow-lg shadow-saffron-500/20 active:scale-95 transition-transform flex items-center gap-2 pr-3">
                        <RefreshCw className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase">Recapture</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <button type="button" onClick={startTacticalCamera} className="flex flex-col items-center gap-2 text-dark-400 hover:text-saffron-500 transition-colors">
                    <Camera className="w-10 h-10" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Open Tactical Camera</span>
                  </button>
                )}
              </div>
              <canvas ref={canvasRef} className="hidden" />
            </div>

            {/* Right: Data Entry */}
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-xs font-black text-dark-400 uppercase tracking-[0.2em] px-1">Support Status</label>
                  <select value={form.support_status} onChange={e => setForm({ ...form, support_status: e.target.value })} className="form-input" required>
                    <option value="supporter">Supporter</option>
                    <option value="neutral">Neutral</option>
                    <option value="opponent">Opponent</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-black text-dark-400 uppercase tracking-[0.2em] px-1">Satisfaction</label>
                  <select value={form.satisfaction_level} onChange={e => setForm({ ...form, satisfaction_level: e.target.value })} className="form-input">
                    {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} Star{n > 1 ? 's' : ''}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-black text-dark-400 uppercase tracking-[0.2em] px-1">Tactical Observations</label>
                <textarea value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} className="form-input h-36 resize-none" placeholder="Provide detailed field observations, voter concerns, or strategic insights..." />
              </div>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
