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
  Activity, HelpCircle, Heart, Users, Eye, Download
} from 'lucide-react';
import Modal from '@/components/Modal';
import { MODULE_HEADER, SHARED_UI } from '@/lib/ui-labels';
import { useLanguage } from '@/context/LanguageContext';
import StatsSummary from '@/components/dashboard/StatsSummary';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import DetailsModal from '@/components/DetailsModal';
import SpeechToTextButton from '@/components/SpeechToTextButton';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function SurveysPage() {
  const { t } = useLanguage();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);
  const [view, setView] = useState<'list' | 'analytics'>('list');
  const [supportFilter, setSupportFilter] = useState('');
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });

  const [questions, setQuestions] = useState<any[]>([]);
  const [customAnswers, setCustomAnswers] = useState<Record<number, string>>({});

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

  useEffect(() => {
    loadSurveys();
    loadStats();
    loadQuestions();
  }, [supportFilter]);

  const loadQuestions = async () => {
    try {
      const res = await surveysAPI.getQuestions();
      setQuestions(res.data.data || []);
    } catch (err) {
      console.error('Failed to load questions:', err);
    }
  };

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
      showToast.error(t('surveys.camera_denied', 'Capture access denied. Check permissions.'));
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

  const handleExportCSV = async () => {
    try {
      toast.loading(t('surveys.exporting', 'Exporting surveys...'), { id: 'csv-export' });
      const res = await surveysAPI.getAll({ page: 1, limit: 5000 });
      const allSurveys: Survey[] = res.data.data || [];

      if (allSurveys.length === 0) {
        toast.error(t('surveys.no_data_export', 'No surveys available to export.'), { id: 'csv-export' });
        return;
      }

      const questionHeaders: { id: number; text: string }[] = [];
      const seenQuestionIds = new Set<number>();

      questions.forEach(q => {
        if (!seenQuestionIds.has(q.id)) {
          seenQuestionIds.add(q.id);
          questionHeaders.push({ id: q.id, text: q.question_text });
        }
      });

      allSurveys.forEach(s => {
        s.answers?.forEach(ans => {
          if (!seenQuestionIds.has(ans.question_id)) {
            seenQuestionIds.add(ans.question_id);
            questionHeaders.push({ id: ans.question_id, text: ans.question_text || `Question ${ans.question_id}` });
          }
        });
      });

      const baseHeaders = [
        'ID',
        'Voter Name',
        'Voter Phone',
        'Surveyor Name',
        'Support Status',
        'Satisfaction Score',
        'Ward',
        'Booth',
        'Observations/Remarks',
        'Date'
      ];
      const headers = [...baseHeaders, ...questionHeaders.map(q => q.text)];

      const escapeCSVValue = (val: any) => {
        if (val === null || val === undefined) return '';
        let str = String(val);
        str = str.replace(/"/g, '""');
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
          return `"${str}"`;
        }
        return str;
      };

      const csvRows = [
        headers.join(','),
        ...allSurveys.map(s => {
          const row = [
            s.id,
            s.voter_name || 'Anonymous',
            s.voter_phone || '',
            s.surveyor_name || '',
            s.support_status,
            s.satisfaction_level || '',
            s.ward_name || '',
            s.booth_name || '',
            s.remarks || '',
            s.created_at ? new Date(s.created_at).toLocaleDateString() : ''
          ];

          questionHeaders.forEach(qh => {
            const match = s.answers?.find(a => a.question_id === qh.id);
            row.push(match ? match.answer_text : '');
          });

          return row.map(escapeCSVValue).join(',');
        })
      ];

      const csvContent = '\uFEFF' + csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `surveys_export_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(t('surveys.export_success', 'Surveys exported successfully!'), { id: 'csv-export' });
    } catch (err) {
      console.error(err);
      toast.error(t('surveys.export_failed', 'Failed to export CSV.'), { id: 'csv-export' });
    }
  };

  const getOptionsArray = (options: any): string[] => {
    if (!options) return [];
    if (Array.isArray(options)) return options;
    if (typeof options === 'string') {
      try {
        const parsed = JSON.parse(options);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return options.split(',').map((s: string) => s.trim());
      }
    }
    return [];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Front-end Validation
    for (const q of questions) {
      const ans = customAnswers[q.id];
      if (ans === undefined || ans === null || String(ans).trim() === '') {
        showToast.error(`Answer to "${q.question_text}" is required.`);
        return;
      }
    }

    try {
      setLoading(true);
      const answersPayload = Object.entries(customAnswers).map(([questionId, value]) => ({
        question_id: parseInt(questionId),
        answer_text: value
      }));

      await surveysAPI.create({
        ...form,
        satisfaction_level: parseInt(form.satisfaction_level),
        answers: answersPayload
      });
      setShowModal(false);
      setForm({ support_status: 'neutral', satisfaction_level: '3', remarks: '', image_url: '' });
      setCustomAnswers({});
      loadSurveys();
      loadStats();
      showToast.success(t('surveys.created_success', 'Survey recorded successfully.'));
    } catch (err: any) {
      showToast.error(err.response?.data?.message || 'Error saving survey');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    showToast.confirm(
      t('surveys.delete_survey_title', 'Delete Survey'),
      t('surveys.delete_survey_confirm', 'Are you sure you want to delete this survey entry? This data will be permanently removed from analytics.'),
      async () => {
        try { 
          await surveysAPI.delete(id); 
          loadSurveys(); 
          loadStats(); 
          toast.success(t('surveys.deleted_success', 'Survey deleted'));
        } catch (err) {
          showToast.error(t('surveys.delete_failed', 'Failed to delete survey'));
        }
      },
      t('action.delete', 'Delete')
    );
  };

  const supportBadge = (s: string) => {
    switch (s) { case 'supporter': return 'badge-success'; case 'neutral': return 'badge-warning'; case 'opponent': return 'badge-danger'; default: return 'badge-neutral'; }
  };

  return (
    <>
      <Header title={MODULE_HEADER.surveys.title} subtitle={MODULE_HEADER.surveys.subtitle} />
      <div className="dashboard-container">
        {/* View Toggle */}
        <div className="flex items-center justify-between mb-6">
          <div className="tabs-toggle">
            <button onClick={() => setView('list')} className={`tabs-toggle-item ${view === 'list' ? 'tabs-toggle-item-active' : 'tabs-toggle-item-inactive'}`}>
              <ClipboardList className="w-4 h-4" />{t('surveys.list_view', 'List')}
            </button>
            <button onClick={() => setView('analytics')} className={`tabs-toggle-item ${view === 'analytics' ? 'tabs-toggle-item-active' : 'tabs-toggle-item-inactive'}`}>
              <BarChart3 className="w-4 h-4" />{t('surveys.analytics_view', 'Analytics')}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleExportCSV} className="btn-secondary flex items-center gap-2">
              <Download className="w-4 h-4" /> {t('action.export', 'Export CSV')}
            </button>
            <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> {t('worker.submit_survey', 'New Survey')}
            </button>
          </div>
        </div>

        {/* Global Summary Stats */}
        <StatsSummary
          loading={loading && !stats}
          stats={[
            { label: t('dashboard.total_surveys', 'Total Surveys'), value: stats?.total || 0, icon: Activity, color: 'text-purple-500', bgIcon: 'bg-purple-500/10' },
            { label: t('support.supporter', 'Supportive'), value: stats?.support_breakdown?.find((s: any) => s.support_status === 'supporter')?.count || 0, icon: Heart, color: 'text-emerald-500', bgIcon: 'bg-emerald-500/10' },
            { label: t('surveys.issues_found', 'Issues Found'), value: stats?.top_issues?.length || 0, icon: HelpCircle, color: 'text-amber-500', bgIcon: 'bg-amber-500/10' },
            { label: t('surveys.avg_rating', 'Avg Rating'), value: stats?.satisfaction_stats?.average_rating || '0.0', icon: RefreshCw, color: 'text-blue-500', bgIcon: 'bg-blue-500/10' },
          ]}
        />

        {view === 'analytics' && stats ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Support Breakdown */}
            <div className="glass-card p-6">
              <h3 className="text-base font-bold mb-4">{t('surveys.support_breakdown', 'Support Breakdown')}</h3>
              <div className="h-64 flex items-center justify-center">
                <Doughnut
                  data={{
                    labels: stats.support_breakdown.map((s: any) => t('support.' + s.support_status, s.support_status)),
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
              <h3 className="text-base font-bold mb-4">{t('surveys.top_issues_reported', 'Top Issues Reported')}</h3>
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
                {stats.top_issues.length === 0 && <p className="text-dark-500 text-sm">{t('surveys.no_issues_reported', 'No issues reported yet')}</p>}
              </div>
            </div>

            {/* Predefined Dynamic Questions breakdown */}
            {stats.questions_breakdown && stats.questions_breakdown.map((qb: any) => {
              const totalResponses = qb.responses.reduce((sum: number, r: any) => sum + r.count, 0);
              let avgRating = 0;
              if (qb.answer_type === 'rating' && totalResponses > 0) {
                const totalStars = qb.responses.reduce((sum: number, r: any) => sum + (parseInt(r.answer) * r.count), 0);
                avgRating = Math.round((totalStars / totalResponses) * 10) / 10;
              }

              return (
                <div key={qb.question_id} className="glass-card p-6 col-span-1 lg:col-span-2">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="text-[10px] font-black text-saffron-500 uppercase tracking-widest block mb-1">
                        {t('surveys.question_type_' + qb.answer_type, qb.answer_type.replace('_', ' '))}
                      </span>
                      <h3 className="text-base font-bold text-dark-900 dark:text-dark-100">{qb.question_text}</h3>
                    </div>
                    {qb.answer_type === 'rating' && totalResponses > 0 && (
                      <div className="bg-yellow-400/10 border border-yellow-400/20 text-yellow-500 rounded-xl px-3 py-1 flex items-center gap-1">
                        <span className="font-bold text-sm">{avgRating}</span>
                        <span className="text-sm">★</span>
                        <span className="text-xs text-dark-400">({totalResponses})</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    {qb.responses.map((resp: any, ri: number) => {
                      const percentage = totalResponses > 0 ? Math.round((resp.count / totalResponses) * 100) : 0;
                      return (
                        <div key={ri} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-dark-700 dark:text-dark-300 font-medium">
                              {qb.answer_type === 'rating' ? `${resp.answer} ${parseInt(resp.answer) === 1 ? 'Star' : 'Stars'}` : resp.answer}
                            </span>
                            <span className="font-bold text-dark-900 dark:text-dark-200">{resp.count} ({percentage}%)</span>
                          </div>
                          <div className="h-2 bg-dark-100 dark:bg-dark-800/50 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-saffron-500 to-saffron-400 rounded-full"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    {qb.responses.length === 0 && (
                      <p className="text-dark-500 text-sm">{t('surveys.no_responses', 'No responses recorded yet')}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <>
            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-6">
              {['', 'supporter', 'neutral', 'opponent'].map(s => (
                <button key={s} onClick={() => setSupportFilter(s)}
                  className={`filter-tab ${supportFilter === s ? 'active' : ''}`}>
                  {s ? t('support.' + s, s) : t('label.all', 'All')}
                </button>
              ))}
            </div>

            {/* Survey List with Horizontal Scroll */}
            <div className="glass-card table-responsive">
              <table className="data-table">
                <thead>
                    <tr>
                      <th>{t('voters.table_voter', 'Voter')}</th>
                      <th>{t('surveys.table_surveyor', 'Surveyor')}</th>
                      <th>{t('voters.table_support', 'Support')}</th>
                      <th>{t('surveys.table_satisfaction', 'Satisfaction')}</th>
                      <th>{t('label.booth', 'Booth')}</th>
                      <th>{t('surveys.table_survey_name', 'Survey Name')}</th>
                      {questions.map(q => (
                        <th key={q.id}>{q.question_text}</th>
                      ))}
                      <th>{t('label.date', 'Date')}</th>
                      <th className="text-right">{t('voters.table_actions', 'Actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={8 + questions.length} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-saffron-400" /></td></tr>
                    ) : surveys.length === 0 ? (
                      <tr><td colSpan={8 + questions.length} className="text-center py-12 text-dark-500">{t('surveys.no_surveys_found', 'No surveys found')}</td></tr>
                    ) : (
                      surveys.map(survey => (
                        <tr key={survey.id}>
                          <td className="font-bold text-dark-900 dark:text-dark-100">{survey.voter_name || t('surveys.anonymous', 'Anonymous')}</td>
                          <td className="text-dark-700 dark:text-dark-400 font-medium">{survey.surveyor_name || '—'}</td>
                          <td><span className={`badge ${supportBadge(survey.support_status)} capitalize`}>{t('support.' + survey.support_status, survey.support_status)}</span></td>
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
                          {questions.map(q => {
                            const ans = survey.answers?.find(a => a.question_id === q.id);
                            return (
                              <td key={q.id} className="text-dark-700 dark:text-dark-300 text-xs max-w-[180px] truncate">
                                {ans ? (q.answer_type === 'rating' ? `${ans.answer_text} ★` : ans.answer_text) : '—'}
                              </td>
                            );
                          })}
                          <td className="text-[11px] font-bold text-dark-600 dark:text-dark-500 uppercase tracking-tighter">{new Date(survey.created_at).toLocaleDateString()}</td>
                          <td className="text-right">
                            <div className="flex items-center gap-2 justify-end">
                              <button onClick={() => setSelectedSurvey(survey)} className="btn-icon btn-secondary" title={t('action.view', 'View details')}><Eye className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleDelete(survey.id)} className="btn-icon bg-red-500/10 border border-red-500/20 text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
          </>
        )}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => { stopTacticalCamera(); setShowModal(false); }}
        title={t('surveys.record_new_survey', 'Record New Survey')}
        subtitle={t('surveys.modal_subtitle', 'Capture voter sentiment and tactical feedback from the field')}
        maxWidth="max-w-[900px]"
        footer={(
          <div className="flex gap-3 w-full sm:w-auto ml-auto">
            <button type="button" onClick={() => { stopTacticalCamera(); setShowModal(false); }} className="btn-secondary px-8">{t('action.cancel', 'Cancel')}</button>
            <button type="submit" form="survey-form" className="btn-primary px-12">{t('worker.submit_survey', 'Submit Survey')}</button>
          </div>
        )}
      >
        <form id="survey-form" onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* Left: Photo proof */}
            <div className="space-y-4">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-[0.2em] px-1">{t('surveys.voter_id_proof', 'Voter/ID Proof (Mandatory)')}</label>
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
                        <span className="text-[10px] font-black text-white uppercase tracking-tighter">{t('action.loading', 'Processing...')}</span>
                      </div>
                    )}
                    <img src={form.image_url} className="w-full h-full object-cover" alt="Captured voter proof" />
                    <div className="absolute top-3 right-3 z-10">
                      <button type="button" onClick={() => { setForm(p => ({ ...p, image_url: '' })); startTacticalCamera(); }} className="bg-saffron-500 text-white p-2 rounded-xl shadow-lg shadow-saffron-500/20 active:scale-95 transition-transform flex items-center gap-2 pr-3">
                        <RefreshCw className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase">{t('surveys.recapture', 'Recapture')}</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <button type="button" onClick={startTacticalCamera} className="flex flex-col items-center gap-2 text-dark-400 hover:text-saffron-500 transition-colors">
                    <Camera className="w-10 h-10" />
                    <span className="text-[10px] font-black uppercase tracking-widest">{SHARED_UI.cameraOpen}</span>
                  </button>
                )}
              </div>
              <canvas ref={canvasRef} className="hidden" />
            </div>

            {/* Right: Data Entry */}
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-xs font-black text-dark-400 uppercase tracking-[0.2em] px-1">{t('label.support', 'Support Status')}</label>
                  <select value={form.support_status} onChange={e => setForm({ ...form, support_status: e.target.value })} className="form-input" required>
                    <option value="supporter">{t('support.supporter', 'Supporter')}</option>
                    <option value="neutral">{t('support.neutral', 'Neutral')}</option>
                    <option value="opponent">{t('support.opponent', 'Opponent')}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-black text-dark-400 uppercase tracking-[0.2em] px-1">{t('surveys.satisfaction', 'Satisfaction')}</label>
                  <select value={form.satisfaction_level} onChange={e => setForm({ ...form, satisfaction_level: e.target.value })} className="form-input">
                    {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} {n > 1 ? t('surveys.stars', 'Stars') : t('surveys.star', 'Star')}</option>)}
                  </select>
                </div>
              </div>

              {/* Dynamic Survey Questions */}
              {questions.map(q => (
                <div key={q.id} className="space-y-2 border-t border-dark-100 dark:border-white/5 pt-4">
                  <label className="block text-xs font-black text-dark-400 uppercase tracking-[0.2em] px-1">
                    {q.question_text} <span className="text-red-500">*</span>
                  </label>
                  {q.answer_type === 'single_choice' && (
                    <select
                      value={customAnswers[q.id] || ''}
                      onChange={e => setCustomAnswers({ ...customAnswers, [q.id]: e.target.value })}
                      className="form-input"
                      required
                    >
                      <option value="">{t('surveys.select_option', 'Select an option')}</option>
                      {getOptionsArray(q.options).map((opt: string) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}
                  {q.answer_type === 'yes_no' && (
                    <div className="flex gap-4 mt-1">
                      {getOptionsArray(q.options || ['Yes', 'No', 'Undecided']).map((opt: string) => (
                        <label key={opt} className="flex items-center gap-2 text-sm text-dark-800 dark:text-dark-200 cursor-pointer">
                          <input
                            type="radio"
                            name={`question-${q.id}`}
                            value={opt}
                            checked={customAnswers[q.id] === opt}
                            onChange={e => setCustomAnswers({ ...customAnswers, [q.id]: e.target.value })}
                            className="form-radio text-saffron-500 focus:ring-saffron-500"
                            required
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {q.answer_type === 'rating' && (
                    <div className="flex gap-1.5 mt-1">
                      {[1, 2, 3, 4, 5].map(star => {
                        const isSelected = star <= parseInt(customAnswers[q.id] || '0');
                        return (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setCustomAnswers({ ...customAnswers, [q.id]: String(star) })}
                            className={`text-2xl transition-colors ${isSelected ? 'text-yellow-400' : 'text-dark-300 dark:text-dark-700 hover:text-yellow-300'}`}
                          >
                            ★
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {q.answer_type === 'text' && (
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={customAnswers[q.id] || ''}
                        onChange={e => setCustomAnswers({ ...customAnswers, [q.id]: e.target.value })}
                        className="form-input flex-1"
                        placeholder={t('surveys.type_answer', 'Type your response here...')}
                        required
                      />
                      <SpeechToTextButton currentValue={customAnswers[q.id] || ''} onTranscript={(text) => setCustomAnswers(prev => ({ ...prev, [q.id]: text }))} />
                    </div>
                  )}
                  {q.answer_type === 'multiple_choice' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                      {getOptionsArray(q.options).map((opt: string) => {
                        const currentSelections = customAnswers[q.id] ? customAnswers[q.id].split(', ') : [];
                        const isChecked = currentSelections.includes(opt);
                        const handleCheckboxChange = (checked: boolean) => {
                          let newSelections;
                          if (checked) {
                            newSelections = [...currentSelections, opt];
                          } else {
                            newSelections = currentSelections.filter(s => s !== opt);
                          }
                          setCustomAnswers({ ...customAnswers, [q.id]: newSelections.join(', ') });
                        };
                        return (
                          <label key={opt} className="flex items-center gap-2 text-sm text-dark-800 dark:text-dark-200 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={e => handleCheckboxChange(e.target.checked)}
                              className="form-checkbox rounded text-saffron-500 focus:ring-saffron-500"
                            />
                            <span>{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}

              <div className="space-y-2 border-t border-dark-100 dark:border-white/5 pt-4">
                <label className="block text-xs font-black text-dark-400 uppercase tracking-[0.2em] px-1">{SHARED_UI.surveyObservations}</label>
                <div className="flex gap-2 items-start">
                  <textarea value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} className="form-input h-36 resize-none flex-1" placeholder={t('surveys.observations_placeholder', 'Provide detailed field observations, voter concerns, or strategic insights...')} />
                  <SpeechToTextButton currentValue={form.remarks} onTranscript={(text) => setForm(prev => ({ ...prev, remarks: text }))} />
                </div>
              </div>
            </div>
          </div>
        </form>
      </Modal>

      <DetailsModal
        isOpen={!!selectedSurvey}
        onClose={() => setSelectedSurvey(null)}
        title={t('surveys.details_title', 'Survey Details')}
        subtitle={t('surveys.details_subtitle', 'Field feedback and sentiment data')}
        items={[
          { label: t('label.name', 'Name'), value: selectedSurvey?.voter_name || t('surveys.anonymous', 'Anonymous') },
          { label: t('label.role', 'Role'), value: 'Survey Record' },
          { label: t('label.support', 'Support Status'), value: selectedSurvey?.support_status ? t('support.' + selectedSurvey.support_status, selectedSurvey.support_status) : '—' },
          { label: t('surveys.table_surveyor', 'Surveyor'), value: selectedSurvey?.surveyor_name || '—' },
          { label: t('label.ward', 'Ward'), value: selectedSurvey?.ward_name || '—' },
          { label: t('label.booth', 'Booth'), value: selectedSurvey?.booth_name || '—' },
          { label: t('surveys.satisfaction', 'Satisfaction Level'), value: selectedSurvey?.satisfaction_level || '—' },
          { label: t('surveys.issues', 'Issues'), value: selectedSurvey?.issues?.map(i => i.issue_name).join(', ') || '—' },
          ...((selectedSurvey?.answers || []).map(ans => ({
            label: ans.question_text || `Question ${ans.question_id}`,
            value: ans.answer_type === 'rating' ? `${ans.answer_text} ★` : ans.answer_text
          }))),
          { label: t('label.remarks', 'Remarks'), value: selectedSurvey?.remarks || '—' },
          { label: t('label.date', 'Created At'), value: selectedSurvey?.created_at ? new Date(selectedSurvey.created_at).toLocaleString() : '—' },
        ]}
      />
    </>
  );
}
