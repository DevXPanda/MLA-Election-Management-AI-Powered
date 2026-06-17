'use client';

import { useState, useEffect, useCallback } from 'react';
import { showToast } from '@/lib/toast';
import Header from '@/components/Header';
import { meetingsAPI, usersAPI } from '@/lib/api';
import { Meeting, User } from '@/types';
import {
  Plus, Edit3, Trash2, X, Loader2, Video, Clock, Users,
  Send, ExternalLink, Copy, Calendar, Search, Check,
  ChevronDown, RefreshCw, Eye
} from 'lucide-react';
import Modal from '@/components/Modal';
import { format } from 'date-fns';
import { MODULE_HEADER } from '@/lib/ui-labels';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';

interface MeetingStats {
  total_meetings: string;
  upcoming_meetings: string;
  completed_meetings: string;
  cancelled_meetings: string;
  total_participants: string;
}

export default function MeetingsPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [stats, setStats] = useState<MeetingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'all'>('upcoming');
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [sendingInvites, setSendingInvites] = useState<number | null>(null);

  // Form state
  const [form, setForm] = useState({
    title: '', description: '', meeting_type: 'scheduled',
    meeting_date: '', duration: '60', send_whatsapp: true,
  });

  // Participant selection
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<number[]>([]);
  const [participantSearch, setParticipantSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showParticipantDropdown, setShowParticipantDropdown] = useState(false);

  const canManage = user?.role_name === 'super_admin' || user?.role_name === 'mla';

  const loadMeetings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await meetingsAPI.getAll({ tab: activeTab, page: meta.page, limit: 20 });
      if (res.data?.success) {
        setMeetings(res.data.data || []);
        if (res.data.meta) setMeta(res.data.meta);
      }
    } catch {
      showToast.error('Failed to load meetings');
    } finally {
      setLoading(false);
    }
  }, [activeTab, meta.page]);

  const loadStats = useCallback(async () => {
    try {
      const res = await meetingsAPI.getStats();
      if (res.data?.success) setStats(res.data.data);
    } catch { /* silent */ }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const res = await usersAPI.getAll({ limit: 500 });
      if (res.data?.success) setAllUsers(res.data.data || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    loadMeetings();
    loadStats();
  }, [loadMeetings, loadStats]);

  const resetForm = () => {
    setForm({
      title: '', description: '', meeting_type: 'scheduled',
      meeting_date: '', duration: '60', send_whatsapp: true,
    });
    setSelectedParticipants([]);
    setEditingMeeting(null);
    setParticipantSearch('');
    setRoleFilter('');
  };

  const openCreateModal = () => {
    resetForm();
    loadUsers();
    setShowModal(true);
  };

  const openEditModal = (meeting: Meeting) => {
    setEditingMeeting(meeting);
    setForm({
      title: meeting.title,
      description: meeting.description || '',
      meeting_type: meeting.meeting_type,
      meeting_date: meeting.meeting_date ? format(new Date(meeting.meeting_date), "yyyy-MM-dd'T'HH:mm") : '',
      duration: String(meeting.duration || 60),
      send_whatsapp: false,
    });
    setSelectedParticipants([]);
    loadUsers();
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.meeting_date) {
      showToast.error('Title and meeting date are required');
      return;
    }

    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        meeting_type: form.meeting_type,
        meeting_date: form.meeting_type === 'instant'
          ? new Date().toISOString()
          : new Date(form.meeting_date).toISOString(),
        duration: parseInt(form.duration) || 60,
        participant_ids: selectedParticipants.length > 0 ? selectedParticipants : undefined,
        send_whatsapp: form.send_whatsapp,
      };

      if (editingMeeting) {
        await meetingsAPI.update(editingMeeting.id, payload);
        showToast.success('Meeting updated successfully');
      } else {
        const res = await meetingsAPI.create(payload);
        showToast.success('Meeting created successfully');
        if (form.meeting_type === 'instant' && res.data?.success) {
          const newMeeting = res.data.data;
          const urlToOpen = newMeeting?.zoom_start_url || newMeeting?.zoom_join_url;
          if (urlToOpen) {
            window.open(urlToOpen, '_blank');
          }
        }
      }

      setShowModal(false);
      resetForm();
      loadMeetings();
      loadStats();
    } catch {
      showToast.error(editingMeeting ? 'Failed to update meeting' : 'Failed to create meeting');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this meeting?')) return;
    try {
      await meetingsAPI.delete(id);
      showToast.success('Meeting deleted');
      loadMeetings();
      loadStats();
    } catch {
      showToast.error('Failed to delete meeting');
    }
  };

  const handleSendInvites = async (id: number) => {
    try {
      setSendingInvites(id);
      const res = await meetingsAPI.sendInvites(id);
      if (res.data?.success) {
        showToast.success(res.data.message || 'Invites sent');
      }
    } catch {
      showToast.error('Failed to send invites');
    } finally {
      setSendingInvites(null);
    }
  };

  const viewMeetingDetails = async (meeting: Meeting) => {
    try {
      setDetailsLoading(true);
      const res = await meetingsAPI.getOne(meeting.id);
      if (res.data?.success) {
        setSelectedMeeting(res.data.data);
      }
    } catch {
      showToast.error('Failed to load meeting details');
    } finally {
      setDetailsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast.success('Copied to clipboard');
  };

  const toggleParticipant = (userId: number) => {
    setSelectedParticipants(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const filteredUsers = allUsers.filter(u => {
    const matchesSearch = !participantSearch ||
      u.name?.toLowerCase().includes(participantSearch.toLowerCase()) ||
      u.phone?.includes(participantSearch);
    const matchesRole = !roleFilter || u.role_name === roleFilter;
    return matchesSearch && matchesRole;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'in_progress': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'completed': return 'bg-dark-500/10 text-dark-400 border-dark-500/20';
      case 'cancelled': return 'bg-red-500/10 text-red-400 border-red-500/20';
      default: return 'bg-dark-500/10 text-dark-400 border-dark-500/20';
    }
  };

  const isUpcoming = (meeting: Meeting) => {
    if (meeting.status === 'completed' || meeting.status === 'cancelled') return false;
    const startDate = new Date(meeting.meeting_date);
    const endDate = new Date(startDate.getTime() + (meeting.duration || 60) * 60 * 1000);
    return new Date() <= endDate;
  };

  return (
    <>
      <Header title={MODULE_HEADER.meetings.title} subtitle={MODULE_HEADER.meetings.subtitle} />

      <div className="p-4 md:p-8 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Meetings', value: stats?.total_meetings || '0', icon: Video, color: 'from-violet-500 to-purple-600' },
            { label: 'Upcoming', value: stats?.upcoming_meetings || '0', icon: Calendar, color: 'from-blue-500 to-cyan-600' },
            { label: 'Completed', value: stats?.completed_meetings || '0', icon: Check, color: 'from-emerald-500 to-green-600' },
            { label: 'Participants', value: stats?.total_participants || '0', icon: Users, color: 'from-saffron-500 to-orange-600' },
          ].map((stat, i) => (
            <div key={i} className="relative overflow-hidden rounded-2xl border border-white/[0.08] dark:border-white/[0.06] bg-white/60 dark:bg-dark-800/60 backdrop-blur-xl p-5 group hover:border-saffron-500/30 transition-all duration-300">
              <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-gradient-to-br opacity-10 -translate-y-4 translate-x-4" style={{ backgroundImage: `linear-gradient(to bottom right, var(--tw-gradient-stops))` }} />
              <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} mb-3 shadow-lg`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
              <p className="text-2xl font-bold text-dark-900 dark:text-white">{stat.value}</p>
              <p className="text-xs text-dark-500 dark:text-dark-400 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {(['upcoming', 'past', 'all'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setMeta(p => ({ ...p, page: 1 })); }}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  activeTab === tab
                    ? 'bg-gradient-to-r from-saffron-500 to-orange-500 text-white shadow-lg shadow-saffron-500/25'
                    : 'bg-white/60 dark:bg-dark-800/60 text-dark-600 dark:text-dark-300 hover:bg-white dark:hover:bg-dark-700/80 border border-white/[0.08] dark:border-white/[0.06]'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => { loadMeetings(); loadStats(); }}
              className="p-2.5 rounded-xl bg-white/60 dark:bg-dark-800/60 border border-white/[0.08] dark:border-white/[0.06] text-dark-500 dark:text-dark-400 hover:text-saffron-500 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {canManage && (
              <button
                onClick={openCreateModal}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-saffron-500 to-orange-500 text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-saffron-500/25 transition-all duration-300 hover:-translate-y-0.5"
              >
                <Plus className="w-4 h-4" />
                New Meeting
              </button>
            )}
          </div>
        </div>

        {/* Meetings List */}
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-saffron-500" />
            </div>
          ) : meetings.length === 0 ? (
            <div className="text-center py-20">
              <Video className="w-16 h-16 mx-auto text-dark-300 dark:text-dark-600 mb-4" />
              <p className="text-dark-500 dark:text-dark-400 text-lg font-medium">No meetings found</p>
              <p className="text-dark-400 dark:text-dark-500 text-sm mt-1">
                {canManage ? 'Create your first meeting to get started' : 'No meetings scheduled yet'}
              </p>
            </div>
          ) : (
            meetings.map(meeting => (
              <div
                key={meeting.id}
                className="relative overflow-hidden rounded-2xl border border-white/[0.08] dark:border-white/[0.06] bg-white/60 dark:bg-dark-800/60 backdrop-blur-xl p-5 hover:border-saffron-500/20 transition-all duration-300 group"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${
                        isUpcoming(meeting)
                          ? 'bg-gradient-to-br from-blue-500 to-cyan-600'
                          : 'bg-gradient-to-br from-dark-400 to-dark-500'
                      } shadow-lg flex-shrink-0`}>
                        <Video className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-dark-900 dark:text-white truncate">{meeting.title}</h3>
                        <p className="text-xs text-dark-500 dark:text-dark-400 mt-0.5">
                          {meeting.created_by_name && `by ${meeting.created_by_name}`}
                          {meeting.constituency_name && ` • ${meeting.constituency_name}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mt-3">
                      <span className="inline-flex items-center gap-1.5 text-xs text-dark-600 dark:text-dark-300">
                        <Calendar className="w-3.5 h-3.5 text-saffron-500" />
                        {format(new Date(meeting.meeting_date), 'MMM dd, yyyy • hh:mm a')}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-xs text-dark-600 dark:text-dark-300">
                        <Clock className="w-3.5 h-3.5 text-blue-400" />
                        {meeting.duration} min
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-xs text-dark-600 dark:text-dark-300">
                        <Users className="w-3.5 h-3.5 text-emerald-400" />
                        {meeting.participant_count || 0} participants
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(meeting.status)}`}>
                        {meeting.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Join button */}
                    {(meeting.zoom_join_url || meeting.zoom_start_url) && isUpcoming(meeting) && (
                      <a
                        href={meeting.created_by === user?.id && meeting.zoom_start_url ? meeting.zoom_start_url : meeting.zoom_join_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl text-xs font-semibold hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Join
                      </a>
                    )}

                    {/* View details */}
                    <button
                      onClick={() => viewMeetingDetails(meeting)}
                      className="p-2 rounded-xl bg-white/80 dark:bg-dark-700/80 text-dark-500 dark:text-dark-400 hover:text-saffron-500 border border-white/[0.08] dark:border-white/[0.06] transition-colors"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    {/* Send invites */}
                    {canManage && meeting.zoom_join_url && (
                      <button
                        onClick={() => handleSendInvites(meeting.id)}
                        disabled={sendingInvites === meeting.id}
                        className="p-2 rounded-xl bg-white/80 dark:bg-dark-700/80 text-dark-500 dark:text-dark-400 hover:text-emerald-500 border border-white/[0.08] dark:border-white/[0.06] transition-colors disabled:opacity-50"
                        title="Send WhatsApp Invites"
                      >
                        {sendingInvites === meeting.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </button>
                    )}

                    {canManage && (
                      <>
                        <button
                          onClick={() => openEditModal(meeting)}
                          className="p-2 rounded-xl bg-white/80 dark:bg-dark-700/80 text-dark-500 dark:text-dark-400 hover:text-blue-500 border border-white/[0.08] dark:border-white/[0.06] transition-colors"
                          title="Edit"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(meeting.id)}
                          className="p-2 rounded-xl bg-white/80 dark:bg-dark-700/80 text-dark-500 dark:text-dark-400 hover:text-red-500 border border-white/[0.08] dark:border-white/[0.06] transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {meta.totalPages > 1 && (
          <div className="flex justify-center gap-2">
            {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setMeta(p => ({ ...p, page }))}
                className={`w-9 h-9 rounded-xl text-sm font-semibold transition-all ${
                  meta.page === page
                    ? 'bg-gradient-to-r from-saffron-500 to-orange-500 text-white shadow-lg'
                    : 'bg-white/60 dark:bg-dark-800/60 text-dark-600 dark:text-dark-300 hover:bg-white dark:hover:bg-dark-700 border border-white/[0.08] dark:border-white/[0.06]'
                }`}
              >
                {page}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Meeting Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); resetForm(); }}
        title={editingMeeting ? 'Edit Meeting' : 'Schedule New Meeting'}
        maxWidth="max-w-[600px]"
      >
        <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-semibold text-dark-700 dark:text-dark-300 mb-1.5">Meeting Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g., Weekly Strategy Meeting"
                  className="w-full px-4 py-2.5 rounded-xl border border-dark-200 dark:border-dark-600 bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400 focus:ring-2 focus:ring-saffron-500/30 focus:border-saffron-500 transition-all text-sm"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-dark-700 dark:text-dark-300 mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Meeting agenda and notes..."
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border border-dark-200 dark:border-dark-600 bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400 focus:ring-2 focus:ring-saffron-500/30 focus:border-saffron-500 transition-all text-sm resize-none"
                />
              </div>

              {/* Date & Duration Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-dark-700 dark:text-dark-300 mb-1.5">Date & Time *</label>
                  <input
                    type="datetime-local"
                    value={form.meeting_date}
                    onChange={e => setForm(f => ({ ...f, meeting_date: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-dark-200 dark:border-dark-600 bg-white dark:bg-dark-700 text-dark-900 dark:text-white focus:ring-2 focus:ring-saffron-500/30 focus:border-saffron-500 transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-dark-700 dark:text-dark-300 mb-1.5">Duration (minutes)</label>
                  <select
                    value={form.duration}
                    onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-dark-200 dark:border-dark-600 bg-white dark:bg-dark-700 text-dark-900 dark:text-white focus:ring-2 focus:ring-saffron-500/30 focus:border-saffron-500 transition-all text-sm"
                  >
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">60 minutes</option>
                    <option value="90">90 minutes</option>
                    <option value="120">2 hours</option>
                    <option value="180">3 hours</option>
                  </select>
                </div>
              </div>

              {/* Meeting Type */}
              <div>
                <label className="block text-sm font-semibold text-dark-700 dark:text-dark-300 mb-1.5">Meeting Type</label>
                <div className="flex gap-3">
                  {['scheduled', 'instant'].map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setForm(f => {
                        const updated = { ...f, meeting_type: type };
                        if (type === 'instant' && !f.meeting_date) {
                          updated.meeting_date = format(new Date(), "yyyy-MM-dd'T'HH:mm");
                        }
                        return updated;
                      })}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                        form.meeting_type === type
                          ? 'bg-gradient-to-r from-saffron-500/10 to-orange-500/10 border-saffron-500/30 text-saffron-600 dark:text-saffron-400'
                          : 'bg-white dark:bg-dark-700 border-dark-200 dark:border-dark-600 text-dark-600 dark:text-dark-300 hover:border-dark-300'
                      }`}
                    >
                      {type === 'scheduled' ? '📅 Scheduled' : '⚡ Instant'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Participant Selection */}
              {!editingMeeting && (
                <div>
                  <label className="block text-sm font-semibold text-dark-700 dark:text-dark-300 mb-1.5">
                    Invite Participants ({selectedParticipants.length} selected)
                  </label>

                  <div className="relative">
                    <div
                      className="w-full px-4 py-2.5 rounded-xl border border-dark-200 dark:border-dark-600 bg-white dark:bg-dark-700 cursor-pointer flex items-center justify-between text-sm"
                      onClick={() => setShowParticipantDropdown(!showParticipantDropdown)}
                    >
                      <span className="text-dark-500 dark:text-dark-400">
                        {selectedParticipants.length > 0
                          ? `${selectedParticipants.length} participant${selectedParticipants.length > 1 ? 's' : ''} selected`
                          : 'Select participants...'}
                      </span>
                      <ChevronDown className={`w-4 h-4 text-dark-400 transition-transform ${showParticipantDropdown ? 'rotate-180' : ''}`} />
                    </div>

                    {showParticipantDropdown && (
                      <div className="absolute z-50 w-full mt-2 rounded-xl border border-dark-200 dark:border-dark-600 bg-white dark:bg-dark-800 shadow-2xl max-h-72 overflow-hidden">
                        {/* Search + Filter */}
                        <div className="p-3 border-b border-dark-100 dark:border-dark-700 space-y-2">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                            <input
                              type="text"
                              value={participantSearch}
                              onChange={e => setParticipantSearch(e.target.value)}
                              placeholder="Search by name or phone..."
                              className="w-full pl-9 pr-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600 bg-dark-50 dark:bg-dark-700 text-sm text-dark-900 dark:text-white placeholder-dark-400 focus:outline-none focus:ring-1 focus:ring-saffron-500/50"
                            />
                          </div>
                          <select
                            value={roleFilter}
                            onChange={e => setRoleFilter(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600 bg-dark-50 dark:bg-dark-700 text-sm text-dark-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-saffron-500/50"
                          >
                            <option value="">All Roles</option>
                            <option value="mla">MLA</option>
                            <option value="campaign_manager">Campaign Manager</option>
                            <option value="ward_head">Ward Head</option>
                            <option value="booth_worker">Booth Worker</option>
                          </select>
                        </div>

                        {/* User List */}
                        <div className="max-h-48 overflow-y-auto">
                          {filteredUsers.length === 0 ? (
                            <p className="text-center py-4 text-sm text-dark-400">No users found</p>
                          ) : (
                            filteredUsers.map(u => (
                              <label
                                key={u.id}
                                className="flex items-center gap-3 px-4 py-2.5 hover:bg-dark-50 dark:hover:bg-dark-700/50 cursor-pointer transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedParticipants.includes(u.id)}
                                  onChange={() => toggleParticipant(u.id)}
                                  className="w-4 h-4 rounded border-dark-300 text-saffron-500 focus:ring-saffron-500/30"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-dark-900 dark:text-white truncate">{u.name}</p>
                                  <p className="text-xs text-dark-500 dark:text-dark-400">
                                    {u.role_display_name}{u.phone ? ` • ${u.phone}` : ''}
                                  </p>
                                </div>
                              </label>
                            ))
                          )}
                        </div>

                        {/* Select all / clear */}
                        <div className="p-2 border-t border-dark-100 dark:border-dark-700 flex gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedParticipants(filteredUsers.map(u => u.id))}
                            className="flex-1 py-1.5 text-xs font-semibold text-saffron-600 dark:text-saffron-400 hover:bg-saffron-500/5 rounded-lg transition-colors"
                          >
                            Select All
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedParticipants([])}
                            className="flex-1 py-1.5 text-xs font-semibold text-dark-500 hover:bg-dark-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Selected participants pills */}
                  {selectedParticipants.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {selectedParticipants.slice(0, 8).map(id => {
                        const u = allUsers.find(user => user.id === id);
                        return u ? (
                          <span key={id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-saffron-500/10 text-saffron-700 dark:text-saffron-400 text-xs font-medium">
                            {u.name}
                            <button type="button" onClick={() => toggleParticipant(id)} className="hover:text-red-500">
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ) : null;
                      })}
                      {selectedParticipants.length > 8 && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-dark-100 dark:bg-dark-700 text-dark-500 text-xs font-medium">
                          +{selectedParticipants.length - 8} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* WhatsApp toggle */}
              {!editingMeeting && (
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={form.send_whatsapp}
                      onChange={e => setForm(f => ({ ...f, send_whatsapp: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-dark-200 dark:bg-dark-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-dark-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500" />
                  </div>
                  <span className="text-sm font-medium text-dark-700 dark:text-dark-300">
                    Send WhatsApp invite to participants
                  </span>
                </label>
              )}

              {/* Submit */}
              <button
                onClick={handleSubmit}
                className="w-full py-3 bg-gradient-to-r from-saffron-500 to-orange-500 text-white rounded-xl font-semibold text-sm hover:shadow-lg hover:shadow-saffron-500/25 transition-all duration-300 hover:-translate-y-0.5"
              >
                {editingMeeting ? 'Update Meeting' : 'Create Meeting & Generate Zoom Link'}
              </button>
            </div>
      </Modal>

      {/* Meeting Details Modal */}
      <Modal
        isOpen={!!selectedMeeting || detailsLoading}
        onClose={() => setSelectedMeeting(null)}
        title={selectedMeeting?.title || 'Meeting Details'}
        maxWidth="max-w-[600px]"
      >
        {detailsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-saffron-500" />
          </div>
        ) : selectedMeeting && (
          <>

                {/* Meeting Info */}
                <div className="space-y-4">
                  {selectedMeeting.description && (
                    <p className="text-sm text-dark-600 dark:text-dark-300">{selectedMeeting.description}</p>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-dark-50 dark:bg-dark-700/50">
                      <p className="text-xs text-dark-500 mb-1">Date & Time</p>
                      <p className="text-sm font-semibold text-dark-900 dark:text-white">
                        {format(new Date(selectedMeeting.meeting_date), 'MMM dd, yyyy • hh:mm a')}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-dark-50 dark:bg-dark-700/50">
                      <p className="text-xs text-dark-500 mb-1">Duration</p>
                      <p className="text-sm font-semibold text-dark-900 dark:text-white">{selectedMeeting.duration} minutes</p>
                    </div>
                    <div className="p-3 rounded-xl bg-dark-50 dark:bg-dark-700/50">
                      <p className="text-xs text-dark-500 mb-1">Status</p>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(selectedMeeting.status)}`}>
                        {selectedMeeting.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-dark-50 dark:bg-dark-700/50">
                      <p className="text-xs text-dark-500 mb-1">Created By</p>
                      <p className="text-sm font-semibold text-dark-900 dark:text-white">{selectedMeeting.created_by_name || '—'}</p>
                    </div>
                  </div>

                  {/* Zoom Details */}
                  {selectedMeeting.zoom_join_url && (
                    <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
                      <h4 className="text-sm font-bold text-dark-900 dark:text-white mb-3 flex items-center gap-2">
                        <Video className="w-4 h-4 text-blue-500" />
                        Zoom Meeting Details
                      </h4>
                      <div className="space-y-2">
                        {selectedMeeting.zoom_meeting_id && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-dark-500">Meeting ID</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-mono text-dark-900 dark:text-white">{selectedMeeting.zoom_meeting_id}</span>
                              <button onClick={() => copyToClipboard(selectedMeeting.zoom_meeting_id!)} className="text-dark-400 hover:text-saffron-500">
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                        {selectedMeeting.zoom_passcode && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-dark-500">Passcode</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-mono text-dark-900 dark:text-white">{selectedMeeting.zoom_passcode}</span>
                              <button onClick={() => copyToClipboard(selectedMeeting.zoom_passcode!)} className="text-dark-400 hover:text-saffron-500">
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                        <div className="flex gap-2 mt-3">
                          <a
                            href={selectedMeeting.created_by === user?.id && selectedMeeting.zoom_start_url ? selectedMeeting.zoom_start_url : selectedMeeting.zoom_join_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl text-sm font-semibold hover:shadow-lg transition-all"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Join Meeting
                          </a>
                          <button
                            onClick={() => copyToClipboard(selectedMeeting.zoom_join_url!)}
                            className="px-4 py-2.5 rounded-xl border border-dark-200 dark:border-dark-600 text-dark-600 dark:text-dark-300 text-sm font-semibold hover:bg-dark-50 dark:hover:bg-dark-700 transition-colors"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {!selectedMeeting.zoom_join_url && (
                    <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
                      <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                        ⚠️ Zoom link not available. Zoom credentials may not be configured.
                      </p>
                    </div>
                  )}

                  {/* Participants */}
                  <div>
                    <h4 className="text-sm font-bold text-dark-900 dark:text-white mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4 text-emerald-500" />
                      Participants ({selectedMeeting.participants?.length || 0})
                    </h4>
                    {selectedMeeting.participants && selectedMeeting.participants.length > 0 ? (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {selectedMeeting.participants.map((p, i) => (
                          <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-dark-50 dark:bg-dark-700/50">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-saffron-500 to-orange-500 flex items-center justify-center text-white text-xs font-bold">
                                {p.name?.[0]?.toUpperCase() || '?'}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-dark-900 dark:text-white">{p.name}</p>
                                <p className="text-xs text-dark-500">{p.role_name}{p.phone ? ` • ${p.phone}` : ''}</p>
                              </div>
                            </div>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                              p.status === 'attended' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                              p.status === 'accepted' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                              p.status === 'declined' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                              'bg-dark-500/10 text-dark-400 border-dark-500/20'
                            }`}>
                              {p.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-dark-400">No participants added yet</p>
                    )}
                  </div>
                </div>
              </>
            )}
      </Modal>
    </>
  );
}
