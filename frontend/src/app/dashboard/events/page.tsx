'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { showToast } from '@/lib/toast';
import Header from '@/components/Header';
import { eventsAPI } from '@/lib/api';
import { AppEvent, WorkAllocation } from '@/types';
import { Plus, Edit3, Trash2, X, Loader2, Calendar, MapPin, Users, Clock, Eye, BarChart3 as BarIcon, Target, Activity } from 'lucide-react';
import Modal from '@/components/Modal';
import { format } from 'date-fns';
import DetailsModal from '@/components/DetailsModal';
import { MODULE_HEADER, EVENTS_UI, EVENT_TYPE_OPTIONS, eventTypeLabel, eventStatusLabel } from '@/lib/ui-labels';
import { useLanguage } from '@/context/LanguageContext';
import SpeechToTextButton from '@/components/SpeechToTextButton';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function EventsPage() {
  const { t } = useLanguage();
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AppEvent | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<AppEvent | null>(null);
  const [executionLog, setExecutionLog] = useState<{
    participants: Array<{ name: string; phone?: string; role_name?: string; attended?: boolean }>;
    work_allocations: WorkAllocation[];
    activity_log: Array<{ id: number; user_name?: string; action: string; module?: string; created_at: string; details?: Record<string, unknown> }>;
    member_workload: Array<{
      name: string;
      phone?: string;
      role?: string;
      work_type: string;
      timing_label: string;
      allocation_status?: string;
      execution_notes?: string;
      not_completed_reason?: string;
      description?: string;
    }>;
    summary: { participant_count: number; allocation_count: number; completed_allocations: number };
  } | null>(null);
  const [executionLoading, setExecutionLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [activeTab, setActiveTab] = useState<'schedule' | 'history'>('schedule');

  const [form, setForm] = useState({
    title: '', type: 'rally', description: '', event_date: '',
    location: '', expected_attendance: '', actual_attendance: '', status: 'upcoming',
  });

  const [feedbackForm, setFeedbackForm] = useState({
    outcome: '',
    key_observations: '',
    public_response: '',
    challenges: '',
    achievements: '',
    attendance_summary: '',
    follow_up: '',
    remarks: ''
  });

  useEffect(() => { loadEvents(); }, [statusFilter, activeTab]);

  useEffect(() => {
    if (!selectedEvent) {
      setExecutionLog(null);
      return;
    }
    let cancelled = false;
    setExecutionLoading(true);
    eventsAPI
      .getExecutionLog(selectedEvent.id)
      .then((res) => {
        if (!cancelled) setExecutionLog(res.data.data);
      })
      .catch(() => {
        if (!cancelled) setExecutionLog(null);
      })
      .finally(() => {
        if (!cancelled) setExecutionLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedEvent]);

  const loadEvents = async (page = 1) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 50 };
      if (statusFilter) params.status = statusFilter;
      const res = await eventsAPI.getAll(params);
      setEvents(res.data.data);
      setMeta(res.data.meta);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditingEvent(null);
    setForm({ title: '', type: 'rally', description: '', event_date: '', location: '', expected_attendance: '', actual_attendance: '', status: 'upcoming' });
    setFeedbackForm({
      outcome: '',
      key_observations: '',
      public_response: '',
      challenges: '',
      achievements: '',
      attendance_summary: '',
      follow_up: '',
      remarks: ''
    });
    setShowModal(true);
  };

  const openEdit = (evt: AppEvent) => {
    setEditingEvent(evt);
    setForm({
      title: evt.title, type: evt.type, description: evt.description || '',
      event_date: evt.event_date ? evt.event_date.slice(0, 16) : '', location: evt.location || '',
      expected_attendance: evt.expected_attendance ? String(evt.expected_attendance) : '',
      actual_attendance: evt.actual_attendance ? String(evt.actual_attendance) : '',
      status: evt.status,
    });
    const fb = (evt.feedback ? (typeof evt.feedback === 'string' ? JSON.parse(evt.feedback) : evt.feedback) : {}) || {};
    setFeedbackForm({
      outcome: fb.outcome || '',
      key_observations: fb.key_observations || '',
      public_response: fb.public_response || '',
      challenges: fb.challenges || '',
      achievements: fb.achievements || '',
      attendance_summary: fb.attendance_summary || '',
      follow_up: fb.follow_up || '',
      remarks: fb.remarks || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data: any = {
        ...form,
        expected_attendance: form.expected_attendance ? parseInt(form.expected_attendance) : 0,
        actual_attendance: form.actual_attendance ? parseInt(form.actual_attendance) : 0
      };
      if (form.status === 'completed') {
        const requiredFields = {
          outcome: 'Event Outcome',
          key_observations: 'Key Observations',
          public_response: 'Public Response',
          challenges: 'Challenges Faced',
          achievements: 'Achievements',
          attendance_summary: 'Attendance Summary',
          follow_up: 'Follow-up Actions',
          remarks: 'Additional Remarks'
        };
        for (const [key, label] of Object.entries(requiredFields)) {
          if (!feedbackForm[key as keyof typeof feedbackForm].trim()) {
            toast.error(`Event Feedback field "${label}" is required.`);
            return;
          }
        }
        data.feedback = feedbackForm;
      }
      if (editingEvent) { await eventsAPI.update(editingEvent.id, data); }
      else { await eventsAPI.create(data); }
      setShowModal(false);
      loadEvents();
    } catch (err: any) {
      showToast.error(err.response?.data?.message || t('event.error.save', 'Error saving event'));
    }
  };

  const handleDelete = async (id: number) => {
    showToast.confirm(
      t('event.delete_title', 'Delete Event'),
      t('event.delete_confirm', 'Are you sure you want to cancel and delete this event? This will remove all associated data.'),
      async () => {
        try {
          await eventsAPI.delete(id);
          loadEvents();
          toast.success(t('event.success.delete', 'Event deleted successfully'));
        } catch (err) {
          showToast.error(t('event.error.delete', 'Failed to delete event'));
        }
      },
      t('action.delete', 'Delete')
    );
  };

  const statusBadge = (s: string) => {
    switch (s) { case 'upcoming': return 'badge-info'; case 'in_progress': return 'badge-warning'; case 'completed': return 'badge-success'; case 'cancelled': return 'badge-danger'; default: return 'badge-neutral'; }
  };

  const displayedEvents = events.filter(evt => {
    if (statusFilter) return true;
    if (activeTab === 'schedule') {
      return evt.status === 'upcoming' || evt.status === 'in_progress';
    } else {
      return evt.status === 'completed' || evt.status === 'cancelled';
    }
  });

  return (
    <>
      <Header title={MODULE_HEADER.events.title} subtitle={MODULE_HEADER.events.subtitle} />
      <div className="p-8">

        {/* Tab Switcher */}
        <div className="flex border-b border-dark-100 dark:border-white/5 mb-6">
          <button
            onClick={() => { setActiveTab('schedule'); setStatusFilter(''); }}
            className={`px-6 py-3 text-sm font-semibold transition-all border-b-2 -mb-[2px] ${activeTab === 'schedule'
              ? 'border-saffron-500 text-saffron-500 font-bold'
              : 'border-transparent text-dark-500 hover:text-dark-700 dark:hover:text-dark-300'
              }`}
          >
            Active Schedule
          </button>
          <button
            onClick={() => { setActiveTab('history'); setStatusFilter(''); }}
            className={`px-6 py-3 text-sm font-semibold transition-all border-b-2 -mb-[2px] ${activeTab === 'history'
              ? 'border-saffron-500 text-saffron-500 font-bold'
              : 'border-transparent text-dark-500 hover:text-dark-700 dark:hover:text-dark-300'
              }`}
          >
            Event History & Analytics
          </button>
        </div>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">
            {activeTab === 'schedule' ? 'Event Schedule' : 'Event History & Performance'}
            <span className="text-dark-500 font-normal text-base"> ({displayedEvents.length})</span>
          </h2>
          {activeTab === 'schedule' && (
            <button onClick={openCreate} className="btn-primary">
              <Plus className="w-4 h-4" /> {t('action.create', 'Create Event')}
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-6">
          {activeTab === 'schedule' ? (
            ['', 'upcoming', 'in_progress'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`filter-tab ${statusFilter === s ? 'filter-tab-active' : 'filter-tab-inactive'}`}>
                {s ? eventStatusLabel(s) : 'All Active'}
              </button>
            ))
          ) : (
            ['', 'completed', 'cancelled'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`filter-tab ${statusFilter === s ? 'filter-tab-active' : 'filter-tab-inactive'}`}>
                {s ? eventStatusLabel(s) : 'All Historical'}
              </button>
            ))
          )}
        </div>

        {/* Analytics Section inside Tab 2 */}
        {activeTab === 'history' && !loading && (
          <div className="space-y-6 mb-8">
            {/* Summary Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="glass-card p-4 flex flex-col justify-center">
                <span className="text-[10px] font-black text-dark-500 uppercase tracking-wider">Completed Events</span>
                <span className="text-xl font-black text-dark-900 dark:text-white mt-1">
                  {events.filter(e => e.status === 'completed').length}
                </span>
              </div>
              <div className="glass-card p-4 flex flex-col justify-center">
                <span className="text-[10px] font-black text-dark-500 uppercase tracking-wider">Total Expected Attendance</span>
                <span className="text-xl font-black text-dark-900 dark:text-white mt-1">
                  {events.filter(e => e.status === 'completed').reduce((sum, e) => sum + (e.expected_attendance || 0), 0)}
                </span>
              </div>
              <div className="glass-card p-4 flex flex-col justify-center">
                <span className="text-[10px] font-black text-dark-500 uppercase tracking-wider">Total Actual Attendance</span>
                <span className="text-xl font-black text-dark-900 dark:text-white mt-1">
                  {events.filter(e => e.status === 'completed').reduce((sum, e) => sum + (e.actual_attendance || 0), 0)}
                </span>
              </div>
              <div className="glass-card p-4 flex flex-col justify-center">
                <span className="text-[10px] font-black text-dark-500 uppercase tracking-wider">Attendance Success Rate</span>
                <span className="text-xl font-black text-emerald-500 mt-1">
                  {(() => {
                    const completed = events.filter(e => e.status === 'completed');
                    const exp = completed.reduce((sum, e) => sum + (e.expected_attendance || 0), 0);
                    const act = completed.reduce((sum, e) => sum + (e.actual_attendance || 0), 0);
                    return exp > 0 ? `${Math.round((act / exp) * 100)}%` : '—';
                  })()}
                </span>
              </div>
            </div>

            {/* Attendance success chart */}
            {events.filter(e => e.status === 'completed').length > 0 && (
              <div className="glass-card p-6">
                <h3 className="text-sm font-bold text-dark-900 dark:text-white mb-4 flex items-center gap-2">
                  <BarIcon className="w-4 h-4 text-saffron-500" /> Attendance Comparison Report (Last 5 Events)
                </h3>
                <div className="h-[220px]">
                  <Bar
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { position: 'top' as const, labels: { color: '#94a3b8', font: { size: 10 } } }
                      },
                      scales: {
                        x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { display: false } },
                        y: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } }
                      }
                    }}
                    data={{
                      labels: events.filter(e => e.status === 'completed').slice(0, 5).reverse().map(e => e.title),
                      datasets: [
                        {
                          label: 'Expected',
                          data: events.filter(e => e.status === 'completed').slice(0, 5).reverse().map(e => e.expected_attendance),
                          backgroundColor: 'rgba(99, 102, 241, 0.4)',
                          borderColor: 'rgb(99, 102, 241)',
                          borderWidth: 1,
                        },
                        {
                          label: 'Actual',
                          data: events.filter(e => e.status === 'completed').slice(0, 5).reverse().map(e => e.actual_attendance),
                          backgroundColor: 'rgba(249, 115, 22, 0.8)',
                          borderColor: 'rgb(249, 115, 22)',
                          borderWidth: 1,
                        }
                      ]
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Event Cards */}
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-saffron-400" /></div>
        ) : displayedEvents.length === 0 ? (
          <div className="text-center py-16 glass-card">
            <Calendar className="w-12 h-12 text-dark-700 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-dark-300">{t('event.no_events', 'No events found')}</h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {displayedEvents.map(evt => (
              <div key={evt.id} className="glass-card-hover overflow-hidden group">
                {/* Date strip */}
                <div className="bg-gradient-to-r from-saffron-600 to-saffron-500 px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white text-sm font-semibold">
                    <Calendar className="w-4 h-4" />
                    {evt.event_date ? format(new Date(evt.event_date), 'dd MMM yyyy, hh:mm a') : '—'}
                  </div>
                  <span className={`badge ${statusBadge(evt.status)} text-[10px]`}>{eventStatusLabel(evt.status)}</span>
                </div>
                {/* Content */}
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-dark-900 dark:text-dark-100 text-lg group-hover:text-saffron-600 transition-colors uppercase tracking-tight">{evt.title}</h3>
                      <span className="badge badge-neutral text-[10px] mt-1 font-bold uppercase tracking-widest">{eventTypeLabel(evt.type)}</span>
                    </div>
                  </div>
                  {evt.description && <p className="text-sm text-dark-700 dark:text-dark-400 mb-3 line-clamp-2 leading-relaxed">{evt.description}</p>}
                  <div className="flex items-center gap-4 text-[11px] font-bold uppercase tracking-wider text-dark-600 dark:text-dark-500">
                    {evt.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-saffron-500" />{evt.location}</span>}
                    <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-blue-500" />{evt.participant_count || 0} {t('label.joined', 'joined')}</span>
                  </div>
                  {/* Footer actions */}
                  <div className="flex gap-2 mt-4 pt-3 border-t border-white/5">
                    <button onClick={() => setSelectedEvent(evt)} className="btn-secondary btn-sm flex-1"><Eye className="w-3 h-3" /> {t('action.view', 'View')}</button>
                    <button onClick={() => openEdit(evt)} className="btn-secondary btn-sm flex-1"><Edit3 className="w-3 h-3" /> {t('action.edit', 'Edit')}</button>
                    <button onClick={() => handleDelete(evt.id)} className="btn-sm bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-3"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingEvent ? EVENTS_UI.modalEditTitle : EVENTS_UI.modalCreateTitle}
        subtitle={EVENTS_UI.modalSubtitle}
        maxWidth="max-w-[700px]"
        footer={(
          <>
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary min-w-[120px]">{t('action.cancel', 'Cancel')}</button>
            <button type="submit" form="event-form" className="btn-primary min-w-[180px]">
              {editingEvent ? EVENTS_UI.modalFooterSave : EVENTS_UI.modalFooterSchedule}
            </button>
          </>
        )}
      >
        <form id="event-form" onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">{t('event.title_label', 'Event Title *')}</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="form-input" placeholder={t('event.title_placeholder', 'e.g. Mega Rally 2024')} required />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">{t('label.category', 'Event Category')}</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="form-input">
                {EVENT_TYPE_OPTIONS.map(tOption => <option key={tOption.value} value={tOption.value}>{tOption.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">{t('label.date_time', 'Date & Time *')}</label>
              <input type="datetime-local" value={form.event_date} onChange={e => setForm({ ...form, event_date: e.target.value })} className="form-input" required />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">{EVENTS_UI.locationLabel}</label>
              <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className="form-input" placeholder={t('label.venue_placeholder', 'Venue or landmark...')} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">{t('event.description_label', 'Event Description & Strategy')}</label>
            <div className="flex gap-2 items-start">
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="form-input h-24 resize-none flex-1" placeholder={t('label.plan_placeholder', 'Provide detailed plan for the event...')} />
              <SpeechToTextButton currentValue={form.description} onTranscript={(text) => setForm(prev => ({ ...prev, description: text }))} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">{t('label.expected_attendance', 'Expected Attendance')}</label>
              <input type="number" value={form.expected_attendance} onChange={e => setForm({ ...form, expected_attendance: e.target.value })} className="form-input" placeholder="0" />
            </div>
            {editingEvent && (
              <div className="space-y-2">
                <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">{EVENTS_UI.statusLabel}</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="form-input">
                  <option value="upcoming">{t('label.upcoming', 'Upcoming')}</option>
                  <option value="in_progress">{t('label.processing', 'In Progress')}</option>
                  <option value="completed">{t('label.completed', 'Completed')}</option>
                  <option value="cancelled">{t('label.cancelled', 'Cancelled')}</option>
                </select>
              </div>
            )}
          </div>

          {form.status === 'completed' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Actual Attendance *</label>
                <input type="number" value={form.actual_attendance} onChange={e => setForm({ ...form, actual_attendance: e.target.value })} className="form-input" placeholder="0" required />
              </div>
            </div>
          )}

          {form.status === 'completed' && (
            <div className="border-t border-dark-100 dark:border-white/5 pt-6 space-y-6">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-saffron-500" />
                <h4 className="text-sm font-bold text-saffron-600 dark:text-saffron-400 uppercase tracking-wider">Event Completion Feedback (Mandatory)</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Event Outcome *</label>
                  <div className="flex gap-2 items-start">
                    <textarea value={feedbackForm.outcome} onChange={e => setFeedbackForm({ ...feedbackForm, outcome: e.target.value })} className="form-input h-20 resize-none flex-1" placeholder="Summary of what was achieved..." required />
                    <SpeechToTextButton currentValue={feedbackForm.outcome} onTranscript={(text) => setFeedbackForm(prev => ({ ...prev, outcome: text }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Key Observations *</label>
                  <div className="flex gap-2 items-start">
                    <textarea value={feedbackForm.key_observations} onChange={e => setFeedbackForm({ ...feedbackForm, key_observations: e.target.value })} className="form-input h-20 resize-none flex-1" placeholder="Important takeaways or voter remarks..." required />
                    <SpeechToTextButton currentValue={feedbackForm.key_observations} onTranscript={(text) => setFeedbackForm(prev => ({ ...prev, key_observations: text }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Public Response *</label>
                  <div className="flex gap-2 items-start">
                    <textarea value={feedbackForm.public_response} onChange={e => setFeedbackForm({ ...feedbackForm, public_response: e.target.value })} className="form-input h-20 resize-none flex-1" placeholder="Sentiment of the audience..." required />
                    <SpeechToTextButton currentValue={feedbackForm.public_response} onTranscript={(text) => setFeedbackForm(prev => ({ ...prev, public_response: text }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Challenges Faced *</label>
                  <div className="flex gap-2 items-start">
                    <textarea value={feedbackForm.challenges} onChange={e => setFeedbackForm({ ...feedbackForm, challenges: e.target.value })} className="form-input h-20 resize-none flex-1" placeholder="Any issues, delays, or logistical blocks..." required />
                    <SpeechToTextButton currentValue={feedbackForm.challenges} onTranscript={(text) => setFeedbackForm(prev => ({ ...prev, challenges: text }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Achievements *</label>
                  <div className="flex gap-2 items-start">
                    <textarea value={feedbackForm.achievements} onChange={e => setFeedbackForm({ ...feedbackForm, achievements: e.target.value })} className="form-input h-20 resize-none flex-1" placeholder="Highlights and successes..." required />
                    <SpeechToTextButton currentValue={feedbackForm.achievements} onTranscript={(text) => setFeedbackForm(prev => ({ ...prev, achievements: text }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Attendance Summary *</label>
                  <div className="flex gap-2 items-start">
                    <textarea value={feedbackForm.attendance_summary} onChange={e => setFeedbackForm({ ...feedbackForm, attendance_summary: e.target.value })} className="form-input h-20 resize-none flex-1" placeholder="Crowd composition and mobilization details..." required />
                    <SpeechToTextButton currentValue={feedbackForm.attendance_summary} onTranscript={(text) => setFeedbackForm(prev => ({ ...prev, attendance_summary: text }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Follow-up Actions *</label>
                  <div className="flex gap-2 items-start">
                    <textarea value={feedbackForm.follow_up} onChange={e => setFeedbackForm({ ...feedbackForm, follow_up: e.target.value })} className="form-input h-20 resize-none flex-1" placeholder="Actions to take post-event..." required />
                    <SpeechToTextButton currentValue={feedbackForm.follow_up} onTranscript={(text) => setFeedbackForm(prev => ({ ...prev, follow_up: text }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Additional Remarks *</label>
                  <div className="flex gap-2 items-start">
                    <textarea value={feedbackForm.remarks} onChange={e => setFeedbackForm({ ...feedbackForm, remarks: e.target.value })} className="form-input h-20 resize-none flex-1" placeholder="Any other notes..." required />
                    <SpeechToTextButton currentValue={feedbackForm.remarks} onTranscript={(text) => setFeedbackForm(prev => ({ ...prev, remarks: text }))} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </form>
      </Modal>

      <DetailsModal
        isOpen={!!selectedEvent}
        onClose={() => { setSelectedEvent(null); setExecutionLog(null); }}
        title={t('event.details_title', 'Event Details')}
        subtitle={EVENTS_UI.detailsSubtitle}
        items={[
          { label: t('label.name', 'Name'), value: selectedEvent?.title || '—' },
          { label: t('event.type_label', 'Event type'), value: selectedEvent?.type ? eventTypeLabel(selectedEvent.type) : '—' },
          { label: t('event.organizer', 'Organizer'), value: selectedEvent?.created_by_name || '—' },
          { label: t('label.ward', 'Ward'), value: selectedEvent?.ward_name || '—' },
          { label: t('label.booth', 'Booth'), value: '—' },
          { label: t('label.constituency', 'Constituency'), value: selectedEvent?.constituency_name || '—' },
          { label: t('label.location', 'Location'), value: selectedEvent?.location || '—' },
          { label: t('label.status', 'Status'), value: selectedEvent?.status ? eventStatusLabel(selectedEvent.status) : '—' },
          { label: t('label.expected_attendance', 'Expected Attendance'), value: selectedEvent?.expected_attendance ?? '—' },
          { label: t('event.actual_attendance', 'Actual Attendance'), value: selectedEvent?.actual_attendance ?? '—' },
          { label: t('event.date_label', 'Event Date'), value: selectedEvent?.event_date ? new Date(selectedEvent.event_date).toLocaleString() : '—' },
          { label: t('label.description', 'Description'), value: selectedEvent?.description || '—' },
        ]}
        extra={
          <>
            {(() => {
              const fb = selectedEvent?.feedback
                ? (typeof selectedEvent.feedback === 'string'
                  ? JSON.parse(selectedEvent.feedback)
                  : selectedEvent.feedback)
                : null;
              if (selectedEvent?.status !== 'completed' || !fb) return null;
              return (
                <div className="rounded-lg border border-saffron-500/30 bg-gradient-to-br from-saffron-500/5 to-transparent p-4 space-y-4">
                  <div className="flex items-center gap-2 border-b border-saffron-500/20 pb-2">
                    <Target className="w-5 h-5 text-saffron-500" />
                    <h4 className="text-sm font-bold text-saffron-600 dark:text-saffron-400 uppercase tracking-wider">Event Performance & Feedback</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="bg-dark-50/50 dark:bg-white/[0.01] p-3 rounded-lg border border-dark-100/50 dark:border-white/5">
                      <p className="font-bold text-dark-500 uppercase tracking-widest text-[9px] mb-1">Event Outcome</p>
                      <p className="text-dark-800 dark:text-dark-200 font-medium">{fb.outcome}</p>
                    </div>
                    <div className="bg-dark-50/50 dark:bg-white/[0.01] p-3 rounded-lg border border-dark-100/50 dark:border-white/5">
                      <p className="font-bold text-dark-500 uppercase tracking-widest text-[9px] mb-1">Achievements</p>
                      <p className="text-dark-800 dark:text-dark-200 font-medium">{fb.achievements}</p>
                    </div>
                    <div className="bg-dark-50/50 dark:bg-white/[0.01] p-3 rounded-lg border border-dark-100/50 dark:border-white/5">
                      <p className="font-bold text-dark-500 uppercase tracking-widest text-[9px] mb-1">Public Response</p>
                      <p className="text-dark-800 dark:text-dark-200 font-medium">{fb.public_response}</p>
                    </div>
                    <div className="bg-dark-50/50 dark:bg-white/[0.01] p-3 rounded-lg border border-dark-100/50 dark:border-white/5">
                      <p className="font-bold text-dark-500 uppercase tracking-widest text-[9px] mb-1">Attendance Summary</p>
                      <p className="text-dark-800 dark:text-dark-200 font-medium">{fb.attendance_summary}</p>
                    </div>
                    <div className="bg-dark-50/50 dark:bg-white/[0.01] p-3 rounded-lg border border-dark-100/50 dark:border-white/5">
                      <p className="font-bold text-dark-500 uppercase tracking-widest text-[9px] mb-1">Key Observations</p>
                      <p className="text-dark-800 dark:text-dark-200 font-medium">{fb.key_observations}</p>
                    </div>
                    <div className="bg-dark-50/50 dark:bg-white/[0.01] p-3 rounded-lg border border-dark-100/50 dark:border-white/5">
                      <p className="font-bold text-dark-500 uppercase tracking-widest text-[9px] mb-1">Challenges Faced</p>
                      <p className="text-dark-800 dark:text-dark-200 font-medium">{fb.challenges}</p>
                    </div>
                    <div className="bg-dark-50/50 dark:bg-white/[0.01] p-3 rounded-lg border border-dark-100/50 dark:border-white/5">
                      <p className="font-bold text-dark-500 uppercase tracking-widest text-[9px] mb-1">Follow-up Actions</p>
                      <p className="text-dark-800 dark:text-dark-200 font-medium">{fb.follow_up}</p>
                    </div>
                    <div className="bg-dark-50/50 dark:bg-white/[0.01] p-3 rounded-lg border border-dark-100/50 dark:border-white/5">
                      <p className="font-bold text-dark-500 uppercase tracking-widest text-[9px] mb-1">Additional Remarks</p>
                      <p className="text-dark-800 dark:text-dark-200 font-medium">{fb.remarks}</p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {executionLoading && (
              <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-saffron-400" />
              </div>
            )}
            {executionLog && (
              <>
                <div className="rounded-lg border border-dark-100 dark:border-white/10 bg-dark-50/40 dark:bg-white/[0.02] p-3">
                  <p className="text-[10px] uppercase tracking-widest text-dark-500 mb-2">{t('event.work_summary', 'Work summary')}</p>
                  <p className="text-xs text-dark-700 dark:text-dark-300">
                    {t('label.participants', 'Participants')}: {executionLog.summary.participant_count} · {t('label.work_items', 'Work items')}: {executionLog.summary.allocation_count} ·
                    {t('label.completed_work', 'Completed work')}: {executionLog.summary.completed_allocations}
                  </p>
                </div>

                <div className="rounded-lg border border-dark-100 dark:border-white/10 bg-dark-50/40 dark:bg-white/[0.02] p-4">
                  <p className="text-[10px] uppercase tracking-widest text-dark-500 mb-3 font-black">{t('event.work_allocations', 'Work Allocations & Tracking')}</p>
                  {executionLog.work_allocations.length === 0 ? (
                    <p className="text-xs text-dark-500 italic">{t('event.no_allocations', 'No work allocations created for this event yet.')}</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[250px] overflow-y-auto custom-scrollbar">
                      {executionLog.work_allocations.map((alloc) => (
                        <div key={alloc.id} className="p-3 rounded-xl border border-dark-100 dark:border-white/5 bg-white dark:bg-dark-950/40 flex flex-col justify-between text-xs">
                          <div>
                            <div className="flex justify-between items-start mb-1.5">
                              <span className="text-[9px] font-black text-saffron-600 dark:text-saffron-500 uppercase tracking-wider">{alloc.work_type}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${alloc.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                alloc.status === 'in_progress' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                                  alloc.status === 'overdue' ? 'bg-red-500/20 text-red-500 border-red-500/30 font-bold animate-pulse' :
                                    alloc.status === 'assigned' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                                      alloc.status === 'cancelled' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                        'bg-dark-500/10 text-dark-500 border-dark-500/20'
                                }`}>
                                {t(`label.${alloc.status}`, alloc.status)}
                              </span>
                            </div>
                            {alloc.description && <p className="text-dark-700 dark:text-dark-400 italic mb-2 line-clamp-2">&quot;{alloc.description}&quot;</p>}
                          </div>
                          <div className="mt-2 pt-2 border-t border-dark-100 dark:border-white/5 flex items-center justify-between text-[10px] text-dark-600 dark:text-dark-500">
                            <span>Assignee: <strong className="text-dark-900 dark:text-dark-200">{alloc.assigned_users?.[0]?.name || 'Unassigned'}</strong></span>
                            <span>Due: {alloc.due_date ? new Date(alloc.due_date).toLocaleDateString() : '—'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {executionLog.participants.length > 0 && (
                  <div className="rounded-lg border border-dark-100 dark:border-white/10 bg-dark-50/40 dark:bg-white/[0.02] p-3">
                    <p className="text-[10px] uppercase tracking-widest text-dark-500 mb-2">{t('event.assigned_members', 'Assigned members')}</p>
                    <ul className="space-y-2 text-xs text-dark-700 dark:text-dark-300 max-h-40 overflow-y-auto">
                      {executionLog.participants.map((p, i) => (
                        <li key={i} className="border-b border-dark-100/80 dark:border-white/5 pb-2 last:border-0">
                          <span className="font-semibold text-dark-900 dark:text-dark-100">{p.name}</span>
                          {p.role_name && <span className="text-dark-500"> · {t(`role.${p.role_name}`, p.role_name?.replace(/_/g, ' '))}</span>}
                          {p.phone && <span className="text-dark-500"> · {p.phone}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {executionLog.member_workload.length > 0 && (
                  <div className="rounded-lg border border-dark-100 dark:border-white/10 bg-dark-50/40 dark:bg-white/[0.02] p-3">
                    <p className="text-[10px] uppercase tracking-widest text-dark-500 mb-2">{t('wa.ui.per_person_execution', 'Per-person execution')}</p>
                    <ul className="space-y-2 text-xs text-dark-700 dark:text-dark-300 max-h-52 overflow-y-auto">
                      {executionLog.member_workload.map((m, i) => (
                        <li key={i} className="border-b border-dark-100/80 dark:border-white/5 pb-2 last:border-0">
                          <div className="font-semibold text-dark-900 dark:text-dark-100">{m.name}</div>
                          <div className="text-dark-500">
                            {m.role && `${t(`role.${m.role}`, m.role?.replace(/_/g, ' '))} · `}
                            {m.work_type} · {t('label.status', 'Status')}: {m.timing_label}
                            {m.allocation_status && ` · ${m.allocation_status}`}
                          </div>
                          {m.execution_notes && <div className="mt-1 text-dark-600">{t('label.notes', 'Notes')}: {m.execution_notes}</div>}
                          {m.not_completed_reason && <div className="mt-1 text-orange-500/90">{m.not_completed_reason}</div>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {executionLog.activity_log.length > 0 && (
                  <div className="rounded-lg border border-dark-100 dark:border-white/10 bg-dark-50/40 dark:bg-white/[0.02] p-3">
                    <p className="text-[10px] uppercase tracking-widest text-dark-500 mb-2">{t('event.timeline_activity', 'Event timeline / activity')}</p>
                    <ul className="space-y-2 text-xs text-dark-700 dark:text-dark-300 max-h-52 overflow-y-auto">
                      {executionLog.activity_log.map((row) => (
                        <li key={row.id} className="border-b border-dark-100/80 dark:border-white/5 pb-2 last:border-0">
                          <span className="font-semibold text-dark-900 dark:text-dark-100">{row.action}</span>
                          {row.module && <span className="text-dark-500"> · {row.module}</span>}
                          {row.user_name && <span className="text-dark-500"> · {row.user_name}</span>}
                          <span className="text-dark-500"> · {format(new Date(row.created_at), 'dd MMM yyyy, hh:mm a')}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </>
        }
      />
    </>
  );
}
