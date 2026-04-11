'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { showToast } from '@/lib/toast';
import Header from '@/components/Header';
import { eventsAPI } from '@/lib/api';
import { AppEvent, WorkAllocation } from '@/types';
import { Plus, Edit3, Trash2, X, Loader2, Calendar, MapPin, Users, Clock, Eye } from 'lucide-react';
import Modal from '@/components/Modal';
import { format } from 'date-fns';
import DetailsModal from '@/components/DetailsModal';
import { MODULE_HEADER, EVENTS_UI, EVENT_TYPE_OPTIONS, eventTypeLabel, eventStatusLabel } from '@/lib/ui-labels';

export default function EventsPage() {
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

  const [form, setForm] = useState({
    title: '', type: 'rally', description: '', event_date: '',
    location: '', expected_attendance: '', status: 'upcoming',
  });

  useEffect(() => { loadEvents(); }, [statusFilter]);

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
      const params: Record<string, string | number> = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      const res = await eventsAPI.getAll(params);
      setEvents(res.data.data);
      setMeta(res.data.meta);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditingEvent(null);
    setForm({ title: '', type: 'rally', description: '', event_date: '', location: '', expected_attendance: '', status: 'upcoming' });
    setShowModal(true);
  };

  const openEdit = (evt: AppEvent) => {
    setEditingEvent(evt);
    setForm({
      title: evt.title, type: evt.type, description: evt.description || '',
      event_date: evt.event_date ? evt.event_date.slice(0, 16) : '', location: evt.location || '',
      expected_attendance: evt.expected_attendance ? String(evt.expected_attendance) : '', status: evt.status,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = { ...form, expected_attendance: form.expected_attendance ? parseInt(form.expected_attendance) : 0 };
      if (editingEvent) { await eventsAPI.update(editingEvent.id, data); }
      else { await eventsAPI.create(data); }
      setShowModal(false);
      loadEvents();
    } catch (err: any) { 
      showToast.error(err.response?.data?.message || 'Error saving event'); 
    }
  };

  const handleDelete = async (id: number) => {
    showToast.confirm(
      'Delete Event',
      'Are you sure you want to cancel and delete this event? This will remove all associated data.',
      async () => {
        try { 
          await eventsAPI.delete(id); 
          loadEvents(); 
          toast.success('Event deleted successfully');
        } catch (err) {
          showToast.error('Failed to delete event');
        }
      },
      'Delete'
    );
  };

  const statusBadge = (s: string) => {
    switch(s) { case 'upcoming': return 'badge-info'; case 'in_progress': return 'badge-warning'; case 'completed': return 'badge-success'; case 'cancelled': return 'badge-danger'; default: return 'badge-neutral'; }
  };

  return (
    <>
      <Header title={MODULE_HEADER.events.title} subtitle={MODULE_HEADER.events.subtitle} />
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">{EVENTS_UI.listHeading} <span className="text-dark-500 font-normal text-base">({meta.total})</span></h2>
          <button onClick={openCreate} className="btn-primary"><Plus className="w-4 h-4" /> Create Event</button>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-6">
          {['', 'upcoming', 'in_progress', 'completed'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`filter-tab ${statusFilter === s ? 'filter-tab-active' : 'filter-tab-inactive'}`}>
              {s ? eventStatusLabel(s) : 'All'}
            </button>
          ))}
        </div>

        {/* Event Cards */}
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-saffron-400" /></div>
        ) : events.length === 0 ? (
          <div className="text-center py-16 glass-card">
            <Calendar className="w-12 h-12 text-dark-700 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-dark-300">No events found</h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {events.map(evt => (
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
                    <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-blue-500" />{evt.participant_count || 0} joined</span>
                  </div>
                  {/* Footer actions */}
                  <div className="flex gap-2 mt-4 pt-3 border-t border-white/5">
                    <button onClick={() => setSelectedEvent(evt)} className="btn-secondary btn-sm flex-1"><Eye className="w-3 h-3" /> View</button>
                    <button onClick={() => openEdit(evt)} className="btn-secondary btn-sm flex-1"><Edit3 className="w-3 h-3" /> Edit</button>
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
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary min-w-[120px]">Cancel</button>
            <button type="submit" form="event-form" className="btn-primary min-w-[180px]">
              {editingEvent ? EVENTS_UI.modalFooterSave : EVENTS_UI.modalFooterSchedule}
            </button>
          </>
        )}
      >
        <form id="event-form" onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Event Title *</label>
              <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="form-input" placeholder="e.g. Mega Rally 2024" required />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Event Category</label>
              <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="form-input">
                {EVENT_TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Date & Time *</label>
              <input type="datetime-local" value={form.event_date} onChange={e => setForm({...form, event_date: e.target.value})} className="form-input" required />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">{EVENTS_UI.locationLabel}</label>
              <input value={form.location} onChange={e => setForm({...form, location: e.target.value})} className="form-input" placeholder="Venue or landmark..." />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Event Description & Strategy</label>
            <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="form-input h-24 resize-none" placeholder="Provide detailed plan for the event..." />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Expected Attendance</label>
              <input type="number" value={form.expected_attendance} onChange={e => setForm({...form, expected_attendance: e.target.value})} className="form-input" placeholder="0" />
            </div>
            {editingEvent && (
              <div className="space-y-2">
                <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">{EVENTS_UI.statusLabel}</label>
                <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="form-input">
                  <option value="upcoming">Upcoming</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            )}
          </div>
        </form>
      </Modal>

      <DetailsModal
        isOpen={!!selectedEvent}
        onClose={() => { setSelectedEvent(null); setExecutionLog(null); }}
        title="Event Details"
        subtitle={EVENTS_UI.detailsSubtitle}
        items={[
          { label: 'Name', value: selectedEvent?.title || '—' },
          { label: 'Event type', value: selectedEvent?.type ? eventTypeLabel(selectedEvent.type) : '—' },
          { label: 'Organizer', value: selectedEvent?.created_by_name || '—' },
          { label: 'Ward', value: selectedEvent?.ward_name || '—' },
          { label: 'Booth', value: '—' },
          { label: 'Constituency', value: selectedEvent?.constituency_name || '—' },
          { label: 'Location', value: selectedEvent?.location || '—' },
          { label: 'Status', value: selectedEvent?.status ? eventStatusLabel(selectedEvent.status) : '—' },
          { label: 'Expected Attendance', value: selectedEvent?.expected_attendance ?? '—' },
          { label: 'Actual Attendance', value: selectedEvent?.actual_attendance ?? '—' },
          { label: 'Event Date', value: selectedEvent?.event_date ? new Date(selectedEvent.event_date).toLocaleString() : '—' },
          { label: 'Description', value: selectedEvent?.description || '—' },
        ]}
        extra={
          <>
            {executionLoading && (
              <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-saffron-400" />
              </div>
            )}
            {executionLog && (
              <>
                <div className="rounded-lg border border-dark-100 dark:border-white/10 bg-dark-50/40 dark:bg-white/[0.02] p-3">
                  <p className="text-[10px] uppercase tracking-widest text-dark-500 mb-2">Work summary</p>
                  <p className="text-xs text-dark-700 dark:text-dark-300">
                    Participants: {executionLog.summary.participant_count} · Work items: {executionLog.summary.allocation_count} ·
                    Completed work: {executionLog.summary.completed_allocations}
                  </p>
                </div>
                {executionLog.participants.length > 0 && (
                  <div className="rounded-lg border border-dark-100 dark:border-white/10 bg-dark-50/40 dark:bg-white/[0.02] p-3">
                    <p className="text-[10px] uppercase tracking-widest text-dark-500 mb-2">Assigned members</p>
                    <ul className="space-y-2 text-xs text-dark-700 dark:text-dark-300 max-h-40 overflow-y-auto">
                      {executionLog.participants.map((p, i) => (
                        <li key={i} className="border-b border-dark-100/80 dark:border-white/5 pb-2 last:border-0">
                          <span className="font-semibold text-dark-900 dark:text-dark-100">{p.name}</span>
                          {p.role_name && <span className="text-dark-500"> · {p.role_name}</span>}
                          {p.phone && <span className="text-dark-500"> · {p.phone}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {executionLog.member_workload.length > 0 && (
                  <div className="rounded-lg border border-dark-100 dark:border-white/10 bg-dark-50/40 dark:bg-white/[0.02] p-3">
                    <p className="text-[10px] uppercase tracking-widest text-dark-500 mb-2">Per-person execution</p>
                    <ul className="space-y-2 text-xs text-dark-700 dark:text-dark-300 max-h-52 overflow-y-auto">
                      {executionLog.member_workload.map((m, i) => (
                        <li key={i} className="border-b border-dark-100/80 dark:border-white/5 pb-2 last:border-0">
                          <div className="font-semibold text-dark-900 dark:text-dark-100">{m.name}</div>
                          <div className="text-dark-500">
                            {m.role && `${m.role} · `}
                            {m.work_type} · Status: {m.timing_label}
                            {m.allocation_status && ` · ${m.allocation_status}`}
                          </div>
                          {m.execution_notes && <div className="mt-1 text-dark-600">Notes: {m.execution_notes}</div>}
                          {m.not_completed_reason && <div className="mt-1 text-orange-500/90">{m.not_completed_reason}</div>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {executionLog.activity_log.length > 0 && (
                  <div className="rounded-lg border border-dark-100 dark:border-white/10 bg-dark-50/40 dark:bg-white/[0.02] p-3">
                    <p className="text-[10px] uppercase tracking-widest text-dark-500 mb-2">Event timeline / activity</p>
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
