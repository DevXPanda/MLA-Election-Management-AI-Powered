'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { showToast } from '@/lib/toast';
import Header from '@/components/Header';
import { workAllocationAPI, eventsAPI, usersAPI } from '@/lib/api';
import { WorkAllocation, AppEvent, User } from '@/types';
import {
  Plus, Edit3, Trash2, X, Loader2, Calendar,
  MapPin, Users, Clock, CheckCircle2, AlertCircle,
  Filter, Search, ListTodo, ClipboardList, Camera,
  CheckCircle, Play, Ban, Image as ImageIcon,
  BarChart3, Activity, TrendingUp, Info, RefreshCw, XCircle, Circle, ArrowRight, Eye
} from 'lucide-react';
import Modal from '@/components/Modal';
import { format } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import StatsSummary from '@/components/dashboard/StatsSummary';
import DetailsModal from '@/components/DetailsModal';
import { WORK_ALLOCATION_UI as WA, MODULE_HEADER } from '@/lib/ui-labels';

export default function WorkAllocationPage() {
  const { user } = useAuth();
  const [allocations, setAllocations] = useState<WorkAllocation[]>([]);
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [workTypes, setWorkTypes] = useState<string[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showExecutionModal, setShowExecutionModal] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState<WorkAllocation | null>(null);
  const [executingAllocation, setExecutingAllocation] = useState<WorkAllocation | null>(null);
  const [selectedAllocation, setSelectedAllocation] = useState<WorkAllocation | null>(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [eventFilter, setEventFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });

  const [form, setForm] = useState({
    event_id: '',
    work_type: '',
    description: '',
    due_date: '',
    assigned_user_ids: [] as number[],
    status: 'pending' as any
  });

  const [execForm, setExecForm] = useState({
    status: '' as any,
    not_completed_reason: '',
    proofType: 'before' as 'before' | 'after' | 'general',
    isUploading: false
  });

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [activeCameraType, setActiveCameraType] = useState<'before' | 'after' | 'general' | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const batchProofInputRef = useRef<HTMLInputElement>(null);

  const isManagement = user?.role_name === 'super_admin' || user?.role_name === 'mla' || user?.role_name === 'campaign_manager';

  useEffect(() => {
    if (isCameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [isCameraActive]);


  const loadAllocations = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      if (eventFilter) params.event_id = eventFilter;
      if (typeFilter) params.work_type = typeFilter;

      const res = await workAllocationAPI.getAll(params);
      setAllocations(res.data.data);
      setMeta(res.data.meta);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load work allocations');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, eventFilter, typeFilter]);

  const loadStats = useCallback(async () => {
    try {
      const res = await workAllocationAPI.getStats();
      setStats(res.data.data);
    } catch (err) {
      console.error('Stats error:', err);
    }
  }, []);

  const loadDependencies = useCallback(async () => {
    try {
      const [evtsRes, typesRes, usersRes] = await Promise.all([
        eventsAPI.getAll({ limit: 100 }),
        workAllocationAPI.getTypes(),
        usersAPI.getAll({ limit: 200 })
      ]);
      setEvents(evtsRes.data.data);
      setWorkTypes(typesRes.data.data);
      setTeamMembers(usersRes.data.data);
    } catch (err) {
      console.error('Error loading dependencies:', err);
    }
  }, []);

  useEffect(() => {
    loadAllocations();
    loadStats();
    if (isManagement || user?.role_name === 'ward_head') {
      loadDependencies();
    }
  }, [loadAllocations, loadStats, loadDependencies, isManagement, user?.role_name]);

  useEffect(() => {
    if (!showExecutionModal || !executingAllocation) return;
    const fresh = allocations.find((a) => a.id === executingAllocation.id);
    if (fresh) setExecutingAllocation(fresh);
  }, [allocations, showExecutionModal, executingAllocation?.id]);

  const openCreate = () => {
    setEditingAllocation(null);
    setForm({
      event_id: '',
      work_type: '',
      description: '',
      due_date: '',
      assigned_user_ids: [],
      status: 'pending'
    });
    setShowModal(true);
  };

  const openEdit = (alloc: WorkAllocation) => {
    setEditingAllocation(alloc);
    setForm({
      event_id: String(alloc.event_id),
      work_type: alloc.work_type,
      description: alloc.description || '',
      due_date: alloc.due_date ? alloc.due_date.slice(0, 16) : '',
      assigned_user_ids: alloc.assigned_users.map(u => u.id),
      status: alloc.status
    });
    setShowModal(true);
  };

  const openExecution = (alloc: WorkAllocation) => {
    setExecutingAllocation(alloc);
    setExecForm({
      status: alloc.status,
      not_completed_reason: alloc.not_completed_reason || '',
      proofType: alloc.status === 'pending' ? 'before' : 'after',
      isUploading: false
    });
    setShowExecutionModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        ...form,
        event_id: parseInt(form.event_id),
        assigned_user_ids: form.assigned_user_ids
      };

      if (editingAllocation) {
        await workAllocationAPI.update(editingAllocation.id, data);
      } else {
        await workAllocationAPI.create(data);
      }

      setShowModal(false);
      loadAllocations();
      loadStats();
    } catch (err: any) {
      showToast.error(err.response?.data?.message || 'Error saving allocation');
    }
  };

  const handleStatusUpdate = async (status: string) => {
    if (!executingAllocation) return;

    if (status === 'not_completed' && !execForm.not_completed_reason) {
      showToast.info('Please provide a reason for non-completion.');
      return;
    }

    try {
      await workAllocationAPI.updateStatus(executingAllocation.id, {
        status,
        not_completed_reason: execForm.not_completed_reason
      });
      setShowExecutionModal(false);
      loadAllocations();
      loadStats();
    } catch (err: any) {
      showToast.error(err.response?.data?.message || 'Update failed');
    }
  };

  const getGeoLocation = async () => {
    return new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 8000,
      });
    });
  };

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error('read failed'));
      r.readAsDataURL(file);
    });

  const startTacticalCamera = async (type: 'before' | 'after' | 'general') => {
    setActiveCameraType(type);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      streamRef.current = stream;
      setIsCameraActive(true);
      toast.success('Camera activated for scan');
    } catch (err) {
      toast.error(WA.cameraDenied);
      setIsCameraActive(false);
      setActiveCameraType(null);
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
    setActiveCameraType(null);
  };

  const captureTacticalPhoto = async () => {
    if (!videoRef.current || !canvasRef.current || !executingAllocation || !activeCameraType) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const proofType = activeCameraType;

    stopTacticalCamera();
    await processPhotoData(dataUrl, proofType);
  };

  const processPhotoData = async (dataUrl: string, category: 'before' | 'after' | 'general') => {
    if (!executingAllocation) return;
    setExecForm((prev) => ({ ...prev, isUploading: true }));

    try {
      const pos = await getGeoLocation();
      const geo = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        timestamp: new Date().toISOString(),
      };
      await workAllocationAPI.uploadProof(executingAllocation.id, {
        proofs: [{ category, image_url: dataUrl, geo_location: geo }],
      });
      toast.success(`Proof (${category}) uploaded.`);
      await loadAllocations();
    } catch (err: unknown) {
      console.error(err);
      showToast.error('Proof submission failed. Check location permissions.');
    } finally {
      setExecForm((prev) => ({ ...prev, isUploading: false }));
    }
  };

  const handleBatchProofFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !executingAllocation) return;
    setExecForm((prev) => ({ ...prev, isUploading: true }));
    try {
      const pos = await getGeoLocation();
      const geo = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        timestamp: new Date().toISOString(),
      };
      const proofs: Array<{ category: string; image_url: string; geo_location: typeof geo }> = [];
      for (const file of Array.from(files)) {
        const image_url = await readFileAsDataUrl(file);
        proofs.push({ category: execForm.proofType, image_url, geo_location: geo });
      }
      await workAllocationAPI.uploadProof(executingAllocation.id, { proofs });
      toast.success(`${proofs.length} proof image(s) uploaded.`);
      e.target.value = '';
      await loadAllocations();
    } catch (err) {
      console.error(err);
      showToast.error('Batch upload failed.');
    } finally {
      setExecForm((prev) => ({ ...prev, isUploading: false }));
    }
  };

  // Removed handleCapture to enforce strict camera-only usage via startTacticalCamera

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this work allocation?')) return;
    try {
      await workAllocationAPI.delete(id);
      loadAllocations();
      loadStats();
    } catch (err) {
      console.error(err);
    }
  };

  const toggleUserAssignment = (userId: number) => {
    setForm(prev => ({
      ...prev,
      assigned_user_ids: prev.assigned_user_ids.includes(userId)
        ? prev.assigned_user_ids.filter(id => id !== userId)
        : [...prev.assigned_user_ids, userId]
    }));
  };

  const statusBadge = (s: string) => {
    switch (s) {
      case 'pending': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'processing': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'completed': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'cancelled': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'not_completed': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      default: return 'bg-dark-500/10 text-dark-500 border-dark-500/20';
    }
  };

  return (
    <>
      <Header title={MODULE_HEADER.workAllocation.title} subtitle={MODULE_HEADER.workAllocation.subtitle} />
      <div className="dashboard-container">

        {/* Real-time Operations Summary */}
        <StatsSummary
          loading={loading && !stats}
          stats={[
            { label: WA.statsTotal, value: stats?.total || 0, icon: ClipboardList, color: 'text-saffron-500', bgIcon: 'bg-saffron-500/10' },
            { label: 'Completed', value: stats?.by_status?.find((s: any) => s.status === 'completed')?.count || 0, icon: CheckCircle2, color: 'text-emerald-500', bgIcon: 'bg-emerald-500/10' },
            { label: 'Processing', value: stats?.by_status?.find((s: any) => s.status === 'processing')?.count || 0, icon: Activity, color: 'text-blue-500', bgIcon: 'bg-blue-500/10' },
            { label: 'Issues/Incomplete', value: stats?.by_status?.find((s: any) => s.status === 'not_completed')?.count || 0, icon: AlertCircle, color: 'text-orange-500', bgIcon: 'bg-orange-500/10' },
          ]}
        />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-medium text-dark-900 dark:text-white uppercase tracking-tighter">{WA.sectionHeading}</h2>
            <p className="text-dark-500 text-sm mt-1">{WA.sectionSub}</p>
          </div>
          {isManagement && (
            <button onClick={openCreate} className="btn-primary flex items-center gap-2 px-6 shadow-lg shadow-saffron-500/20">
              <Plus className="w-4 h-4" /> {WA.createButton}
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="relative group">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500 group-focus-within:text-saffron-500 transition-colors" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="form-input !pl-10 h-11 bg-white dark:bg-dark-900 border-dark-200 dark:border-white/10"
            >
              <option value="">{WA.filterStatusAll}</option>
              <option value="pending">Pending</option>
              <option value="processing">In Progress</option>
              <option value="completed">Completed</option>
              <option value="not_completed">Not Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="relative group">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500 group-focus-within:text-saffron-500 transition-colors" />
            <select
              value={eventFilter}
              onChange={e => setEventFilter(e.target.value)}
              className="form-input !pl-10 h-11 bg-white dark:bg-dark-900 border-dark-200 dark:border-white/10"
            >
              <option value="">All Active Events</option>
              {events.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
          </div>

          <div className="relative group">
            <ClipboardList className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500 group-focus-within:text-saffron-500 transition-colors" />
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="form-input !pl-10 h-11 bg-white dark:bg-dark-900 border-dark-200 dark:border-white/10"
            >
              <option value="">{WA.filterWorkTypeAll}</option>
              {workTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500 group-focus-within:text-saffron-500 transition-colors" />
            <input
              type="text"
              placeholder={WA.searchPlaceholder}
              className="form-input !pl-10 h-11 bg-white dark:bg-dark-900 border-dark-200 dark:border-white/10"
            />
          </div>
        </div>

        {/* Allocation cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full py-20 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-saffron-500" /></div>
          ) : allocations.length === 0 ? (
            <div className="col-span-full text-center py-20 glass-card">
              <ListTodo className="w-16 h-16 text-dark-800 mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-bold text-dark-300">{WA.emptyTitle}</h3>
            </div>
          ) : (
            allocations.map(alloc => (
              <div key={alloc.id} className="glass-card-hover group flex flex-col h-full border-t-4 border-t-dark-100 data-[status=completed]:border-t-emerald-500 data-[status=processing]:border-t-blue-500 data-[status=not_completed]:border-t-orange-500" data-status={alloc.status}>
                <div className="p-6 flex-1">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="text-[10px] font-black text-saffron-600 dark:text-saffron-500 uppercase tracking-[0.2em]">{alloc.work_type}</span>
                      <h3 className="text-xl font-black text-dark-900 dark:text-white leading-tight mt-1 uppercase tracking-tight">{alloc.event_title}</h3>
                    </div>
                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest border ${statusBadge(alloc.status)}`}>
                      {alloc.status.replace('_', ' ')}
                    </span>
                  </div>

                  <p className="text-sm text-dark-700 dark:text-dark-400 mb-6 line-clamp-3 italic leading-relaxed">&quot;{alloc.description || WA.cardFallbackDescription}&quot;</p>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-xs font-bold text-dark-600 dark:text-dark-500 uppercase tracking-tighter">
                      <Clock className="w-4 h-4 text-blue-500" />
                      <span>Deadline: {alloc.due_date ? format(new Date(alloc.due_date), 'dd MMM | hh:mm a') : 'Indefinite'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-bold text-dark-600 dark:text-dark-500 uppercase tracking-tighter">
                      <MapPin className="w-4 h-4 text-red-500" />
                      <span className="truncate">{alloc.event_location || 'Designated Venue'}</span>
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-dark-100 dark:border-white/5">
                    <p className="text-[10px] font-black text-dark-400 uppercase tracking-widest mb-3">{WA.assignedTeamLabel}</p>
                    <div className="flex flex-wrap gap-2">
                      {alloc.assigned_users?.map(u => (
                        <div key={u.id} className="flex items-center gap-1.5 px-2 py-1 bg-dark-50 dark:bg-white/5 rounded border border-dark-200 dark:border-white/10">
                          <div className="w-4 h-4 rounded-full bg-dark-200 dark:bg-white/10 flex items-center justify-center text-[8px] font-black">{u.name.charAt(0)}</div>
                          <span className="text-[10px] font-bold text-dark-700 dark:text-dark-400 uppercase tracking-tighter">{u.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Proof Status */}
                <div className="px-6 py-4 bg-dark-50/50 dark:bg-white/[0.02] flex items-center justify-between">
                  <div className="flex gap-2">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center border ${alloc.before_image_url ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500' : 'bg-dark-200/10 border-dark-200/50 text-dark-400'}`}
                      title={`Before proof${alloc.proofs ? ` (${alloc.proofs.filter((p) => p.category === 'before').length})` : ''}`}
                    >
                      <ImageIcon className="w-4 h-4" />
                    </div>
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center border ${alloc.after_image_url ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500' : 'bg-dark-200/10 border-dark-200/50 text-dark-400'}`}
                      title={`After proof${alloc.proofs ? ` (${alloc.proofs.filter((p) => p.category === 'after').length})` : ''}`}
                    >
                      <ImageIcon className="w-4 h-4" />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => setSelectedAllocation(alloc)} className="btn-icon size-9 bg-white dark:bg-dark-800 border-dark-200 dark:border-white/10" title="View details">
                      <Eye className="w-4 h-4" />
                    </button>
                    {(isManagement) && (
                      <button onClick={() => openEdit(alloc)} className="btn-icon size-9 bg-white dark:bg-dark-800 border-dark-200 dark:border-white/10">
                        <Edit3 className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => openExecution(alloc)} className="btn-primary-sm size-9 flex items-center justify-center p-0 rounded-lg">
                      <Activity className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Proof & status modal */}
      <Modal
        isOpen={showExecutionModal}
        onClose={() => { stopTacticalCamera(); setShowExecutionModal(false); }}
        title={WA.executionModalTitle}
        subtitle={WA.executionModalSubtitle}
        maxWidth="max-w-[1000px]"
        footer={(
          <div className="flex gap-2 w-full sm:w-auto ml-auto">
            <button onClick={() => { stopTacticalCamera(); setShowExecutionModal(false); }} className="btn-secondary w-full sm:px-8 text-xs font-black">{WA.modalClose}</button>
          </div>
        )}
      >
        {executingAllocation && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-8 items-start">
            {/* Left Column: Proof & Description */}
            <div className="lg:col-span-7 space-y-4 sm:space-y-6">
              <div className="p-3 sm:p-4 bg-saffron-500/10 rounded-2xl border border-saffron-500/20 backdrop-blur-md">
                <div className="flex justify-between items-start mb-2 sm:mb-3">
                  <div className="min-w-0 flex-1">
                    <span className="text-[9px] sm:text-[10px] font-black text-saffron-600 uppercase tracking-[0.2em] mb-1 block truncate">{executingAllocation.work_type}</span>
                    <h4 className="text-lg sm:text-xl font-black text-dark-900 dark:text-white uppercase leading-none truncate">{executingAllocation.event_title}</h4>
                  </div>
                  <span className={`text-[8px] sm:text-[10px] font-black uppercase px-2 py-0.5 sm:px-3 sm:py-1 rounded-full border flex-shrink-0 ml-2 ${statusBadge(executingAllocation.status)}`}>{executingAllocation.status}</span>
                </div>
                {executingAllocation.description && (
                  <p className="text-xs sm:text-sm text-dark-500 font-medium leading-relaxed mt-2 border-t border-saffron-500/10 pt-2 line-clamp-2 sm:line-clamp-none">{executingAllocation.description}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {/* Inception Proof (Before) */}
                <div className="space-y-2 sm:space-y-3">
                  <label className="block text-[9px] sm:text-[10px] font-black text-dark-400 uppercase tracking-widest text-center opacity-70">Inception (Before)</label>
                  <div className="relative group aspect-square sm:aspect-video rounded-xl sm:rounded-2xl border-2 border-dashed border-dark-200 dark:border-white/10 overflow-hidden flex flex-col items-center justify-center hover:border-saffron-500/50 transition-all bg-dark-50/50 dark:bg-white/[0.02]">
                    {isCameraActive && activeCameraType === 'before' ? (
                      <div className="absolute inset-0 z-20">
                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                        <div className="absolute inset-x-0 bottom-4 flex justify-center gap-4 px-4">
                          <button onClick={captureTacticalPhoto} className="btn-primary size-12 rounded-full p-0 flex items-center justify-center shadow-lg animate-pulse">
                            <Circle className="w-7 h-7 fill-white" />
                          </button>
                          <button onClick={stopTacticalCamera} className="bg-red-500/80 backdrop-blur-md text-white p-3 rounded-full shadow-lg">
                            <XCircle className="w-6 h-6" />
                          </button>
                        </div>
                      </div>
                    ) : executingAllocation.before_image_url ? (
                      <>
                        {execForm.isUploading && activeCameraType === 'before' && (
                          <div className="absolute inset-0 bg-dark-900/60 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                            <Loader2 className="w-8 h-8 animate-spin text-saffron-500 mb-2" />
                            <span className="text-[10px] font-black text-white uppercase tracking-tighter">Uploading...</span>
                          </div>
                        )}
                        <img src={executingAllocation.before_image_url} className="w-full h-full object-cover" />
                        <div className="absolute top-2 right-2 z-10 flex flex-col gap-1.5 items-end">
                          <button onClick={() => startTacticalCamera('before')} className="bg-saffron-500 text-white p-2 rounded-xl shadow-lg shadow-saffron-500/20 active:scale-90 transition-transform flex items-center gap-2 pr-3">
                            <RefreshCw className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase">Recapture</span>
                          </button>
                          {executingAllocation.geo_location_before && (
                            <div className="bg-black/60 text-[8px] text-white px-1.5 py-0.5 rounded uppercase font-black tracking-tighter backdrop-blur-md border border-white/10">Geo-Tagged</div>
                          )}
                        </div>
                      </>
                    ) : (
                      <button onClick={() => startTacticalCamera('before')} className="flex flex-col items-center gap-2 p-4 text-center">
                        <Camera className="w-8 h-8 text-dark-400 group-hover:text-saffron-500 transition-colors" />
                        <span className="text-[10px] font-black text-dark-500 uppercase tracking-widest">Inception</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Completion Proof (After) */}
                <div className="space-y-2">
                  <label className="block text-[8px] sm:text-[10px] font-black text-dark-400 uppercase tracking-widest text-center opacity-70 truncate">After</label>
                  <div className="relative group aspect-square sm:aspect-video rounded-xl sm:rounded-2xl border-2 border-dashed border-dark-200 dark:border-white/10 overflow-hidden flex flex-col items-center justify-center hover:border-emerald-500/50 transition-all bg-dark-50/50 dark:bg-white/[0.02]">
                    {isCameraActive && activeCameraType === 'after' ? (
                      <div className="absolute inset-0 z-20">
                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                        <div className="absolute inset-x-0 bottom-4 flex justify-center gap-4 px-4">
                          <button onClick={captureTacticalPhoto} className="btn-primary-emerald size-12 rounded-full p-0 flex items-center justify-center shadow-lg animate-pulse">
                            <Circle className="w-7 h-7 fill-white" />
                          </button>
                          <button onClick={stopTacticalCamera} className="bg-red-500/80 backdrop-blur-md text-white p-3 rounded-full shadow-lg">
                            <XCircle className="w-6 h-6" />
                          </button>
                        </div>
                      </div>
                    ) : executingAllocation.after_image_url ? (
                      <>
                        {execForm.isUploading && activeCameraType === 'after' && (
                          <div className="absolute inset-0 bg-dark-900/60 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                            <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-2" />
                            <span className="text-[10px] font-black text-white uppercase tracking-tighter">Uploading...</span>
                          </div>
                        )}
                        <img src={executingAllocation.after_image_url} className="w-full h-full object-cover" />
                        <div className="absolute top-2 right-2 z-10 flex flex-col gap-1.5 items-end">
                          <button onClick={() => startTacticalCamera('after')} className="bg-emerald-500 text-white p-2 rounded-xl shadow-lg shadow-emerald-500/20 active:scale-90 transition-transform flex items-center gap-2 pr-3">
                            <RefreshCw className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase">Recapture</span>
                          </button>
                          {executingAllocation.geo_location_after && (
                            <div className="bg-black/60 text-[8px] text-white px-1.5 py-0.5 rounded uppercase font-black tracking-tighter backdrop-blur-md border border-white/10">Geo-Tagged</div>
                          )}
                        </div>
                      </>
                    ) : (
                      <button onClick={() => startTacticalCamera('after')} className="flex flex-col items-center gap-2 p-4 text-center disabled:opacity-50" disabled={executingAllocation.status === 'pending'}>
                        <Camera className="w-8 h-8 text-dark-400 group-hover:text-emerald-500 transition-colors" />
                        <span className="text-[10px] font-black text-dark-500 uppercase tracking-widest">Completion</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2 sm:space-y-3">
                  <label className="block text-[9px] sm:text-[10px] font-black text-dark-400 uppercase tracking-widest text-center opacity-70">{WA.generalProofCamera}</label>
                  <div className="relative group aspect-video rounded-xl sm:rounded-2xl border-2 border-dashed border-dark-200 dark:border-white/10 overflow-hidden flex flex-col items-center justify-center bg-dark-50/50 dark:bg-white/[0.02]">
                    {isCameraActive && activeCameraType === 'general' ? (
                      <div className="absolute inset-0 z-20">
                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                        <div className="absolute inset-x-0 bottom-4 flex justify-center gap-4 px-4">
                          <button type="button" onClick={captureTacticalPhoto} className="btn-primary size-12 rounded-full p-0 flex items-center justify-center shadow-lg animate-pulse">
                            <Circle className="w-7 h-7 fill-white" />
                          </button>
                          <button type="button" onClick={stopTacticalCamera} className="bg-red-500/80 backdrop-blur-md text-white p-3 rounded-full shadow-lg">
                            <XCircle className="w-6 h-6" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" onClick={() => startTacticalCamera('general')} className="flex flex-col items-center gap-2 p-4 text-center w-full h-full justify-center">
                        <Camera className="w-8 h-8 text-dark-400 group-hover:text-saffron-500 transition-colors" />
                        <span className="text-[10px] font-black text-dark-500 uppercase tracking-widest">Capture</span>
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-[9px] sm:text-[10px] font-black text-dark-400 uppercase tracking-widest opacity-70">{WA.batchUploadLabel}</label>
                  <select
                    value={execForm.proofType}
                    onChange={(e) => setExecForm((p) => ({ ...p, proofType: e.target.value as 'before' | 'after' | 'general' }))}
                    className="form-input mb-2"
                  >
                    <option value="before">Before</option>
                    <option value="after">After</option>
                    <option value="general">General</option>
                  </select>
                  <input
                    ref={batchProofInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleBatchProofFiles}
                  />
                  <button
                    type="button"
                    onClick={() => batchProofInputRef.current?.click()}
                    className="btn-secondary w-full py-3 text-[10px] font-black uppercase"
                    disabled={execForm.isUploading}
                  >
                    {WA.batchSelectImages}
                  </button>
                </div>
              </div>

              {executingAllocation.proofs && executingAllocation.proofs.length > 0 && (
                <div className="rounded-xl border border-dark-200 dark:border-white/10 p-3 bg-dark-50/30 dark:bg-white/[0.02]">
                  <p className="text-[10px] font-black text-dark-400 uppercase tracking-widest mb-2">{WA.proofGalleryHint}</p>
                  <div className="flex flex-wrap gap-2">
                    {executingAllocation.proofs.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setProofPreviewUrl(p.image_url)}
                        className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-lg border border-dark-200 dark:border-white/10 overflow-hidden"
                      >
                        <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                        <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[7px] text-white text-center uppercase font-black py-0.5">{p.category}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Status & Timeline */}
            <div className="lg:col-span-5 space-y-6 lg:border-l lg:border-dark-100 lg:dark:border-white/5 lg:pl-8">
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-dark-400 uppercase tracking-widest">{WA.statusActionsLabel}</label>
                <div className="grid grid-cols-1 gap-2.5">
                  <button onClick={() => handleStatusUpdate('processing')} className="w-full btn-secondary py-3 sm:py-4 flex items-center justify-between px-4 sm:px-6 rounded-xl sm:rounded-2xl group border border-dark-200 dark:border-white/10 hover:border-saffron-500/30">
                    <div className="flex items-center gap-3 text-left min-w-0">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-saffron-500/10 flex items-center justify-center text-saffron-500 flex-shrink-0">
                        <Activity className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-black text-dark-900 dark:text-white uppercase leading-none truncate">{WA.actionStart}</p>
                        <p className="text-[9px] text-dark-500 uppercase font-bold mt-1 truncate">{WA.actionStartSub}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-dark-300 sm:group-hover:text-saffron-500 transition-colors flex-shrink-0" />
                  </button>

                  <button onClick={() => handleStatusUpdate('completed')} className="w-full btn-primary py-3 sm:py-4 flex items-center justify-between px-4 sm:px-6 rounded-xl sm:rounded-2xl group shadow-lg shadow-emerald-500/10 border border-emerald-500/30">
                    <div className="flex items-center gap-3 text-left min-w-0">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/20 flex items-center justify-center text-white flex-shrink-0">
                        <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-black text-white uppercase leading-none truncate">{WA.actionComplete}</p>
                        <p className="text-[9px] text-white/70 uppercase font-bold mt-1 truncate">{WA.actionCompleteSub}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-white/50 sm:group-hover:text-white transition-colors flex-shrink-0" />
                  </button>
                </div>
              </div>

              <div className="p-4 bg-dark-50 dark:bg-white/[0.02] rounded-2xl border border-dark-100 dark:border-white/5">
                <h5 className="text-[10px] font-black text-dark-400 uppercase tracking-widest mb-4">{WA.timelineHeading}</h5>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-dark-500 uppercase">{WA.timelineStarted}</span>
                    <span className="text-[11px] font-black text-dark-900 dark:text-white">{executingAllocation.started_at ? format(new Date(executingAllocation.started_at), 'dd MMM | hh:mm a') : WA.timelineTba}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-dark-500 uppercase">{WA.timelineCompleted}</span>
                    <span className="text-[11px] font-black text-dark-900 dark:text-white">{executingAllocation.completed_at ? format(new Date(executingAllocation.completed_at), 'dd MMM | hh:mm a') : WA.timelineTba}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <button onClick={() => handleStatusUpdate('not_completed')} className="w-full p-2.5 rounded-xl border border-orange-500/30 text-orange-500 text-[10px] font-black uppercase tracking-widest hover:bg-orange-500 hover:text-white transition-all disabled:opacity-50">{WA.actionNotCompleted}</button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Create / edit allocation */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingAllocation ? WA.formEditTitle : WA.formCreateTitle}
        subtitle={WA.formSubtitle}
        maxWidth="max-w-[620px] md:max-w-[700px] lg:max-w-[780px] xl:max-w-[920px]"
        footer={(
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto ml-auto">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary w-full sm:px-8">{WA.formFooterCancel}</button>
            <button type="submit" form="work-alloc-form" className="btn-primary w-full sm:px-12 shadow-lg shadow-saffron-500/20">
              {editingAllocation ? WA.formFooterSave : WA.formFooterCreate}
            </button>
          </div>
        )}
      >
        <form id="work-alloc-form" onSubmit={handleSubmit} className="space-y-5 sm:space-y-7">
          <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-4 gap-3 sm:gap-5">
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-[0.2em] px-1">{WA.formEventLabel}</label>
              <select value={form.event_id} onChange={e => setForm({ ...form, event_id: e.target.value })} className="form-input" required disabled={!!editingAllocation}>
                <option value="">{WA.formSelectEvent}</option>
                {events.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-[0.2em] px-1">{WA.formWorkTypeLabel}</label>
              <select value={form.work_type} onChange={e => setForm({ ...form, work_type: e.target.value })} className="form-input" required>
                <option value="">{WA.formSelectWorkType}</option>
                {workTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-[0.2em] px-1">{WA.formDeadlineLabel}</label>
              <input type="datetime-local" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} className="form-input" />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-[0.2em] px-1">{WA.formStatusLabel}</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="form-input">
                <option value="pending">{WA.formStatusPending}</option>
                <option value="processing">{WA.formStatusProcessing}</option>
                <option value="completed">{WA.formStatusCompleted}</option>
                <option value="cancelled">{WA.formStatusCancelled}</option>
                <option value="not_completed">{WA.formStatusNotCompleted}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-6 items-start">
            <div className="xl:col-span-6 space-y-3 sm:space-y-4">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-[0.2em] px-1">{WA.formAssignLabel}</label>
              <div className="max-h-[240px] sm:max-h-[300px] lg:max-h-[340px] overflow-y-auto pr-1 sm:pr-2 grid grid-cols-1 gap-2.5 sm:gap-3 custom-scrollbar">
                {teamMembers.map(member => (
                  <label key={member.id} className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border-2 transition-all cursor-pointer ${form.assigned_user_ids.includes(member.id) ? 'border-saffron-500 bg-saffron-500/5 shadow-inner' : 'border-dark-100 dark:border-white/5 hover:border-saffron-500/30'}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-saffron-500/10 flex items-center justify-center text-[10px] font-black text-saffron-600 uppercase">{member.name.charAt(0)}</div>
                      <div className="min-w-0">
                        <p className="text-[11px] sm:text-xs font-black text-dark-900 dark:text-white uppercase leading-none truncate">{member.name}</p>
                        <p className="text-[8px] sm:text-[9px] text-dark-500 uppercase font-black mt-1 tracking-tighter truncate">{member.role_display_name}</p>
                      </div>
                    </div>
                    <input type="checkbox" checked={form.assigned_user_ids.includes(member.id)} onChange={() => toggleUserAssignment(member.id)} className="w-5 h-5 rounded-lg border-2 border-dark-300 text-saffron-600 focus:ring-saffron-500" />
                  </label>
                ))}
              </div>
            </div>

            <div className="xl:col-span-6 space-y-3 sm:space-y-4">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-[0.2em] px-1">{WA.formDescriptionLabel}</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="form-input h-[180px] sm:h-[220px] lg:h-[260px] xl:h-[320px] resize-none border-2 focus:border-saffron-500 transition-colors" placeholder={WA.formDescriptionPlaceholder} />
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!proofPreviewUrl}
        onClose={() => setProofPreviewUrl(null)}
        title={WA.proofPreviewTitle}
        subtitle={WA.proofPreviewSubtitle}
        maxWidth="max-w-3xl"
        footer={(
          <button type="button" onClick={() => setProofPreviewUrl(null)} className="btn-secondary min-w-[120px]">
            {WA.modalClose}
          </button>
        )}
      >
        {proofPreviewUrl && (
          <img src={proofPreviewUrl} alt="" className="max-h-[70vh] w-full object-contain rounded-lg border border-dark-100 dark:border-white/10" />
        )}
      </Modal>

      <DetailsModal
        isOpen={!!selectedAllocation}
        onClose={() => setSelectedAllocation(null)}
        title={WA.detailsTitle}
        subtitle={WA.detailsSubtitle}
        items={[
          { label: 'Name', value: selectedAllocation?.event_title || '—' },
          { label: 'Role', value: selectedAllocation?.work_type || '—' },
          { label: 'Designation', value: selectedAllocation?.work_type || '—' },
          { label: 'Assigned Leader', value: selectedAllocation?.created_by_name || '—' },
          { label: 'Ward / Booth', value: selectedAllocation?.event_location || '—' },
          { label: 'Status', value: selectedAllocation?.status || '—' },
          { label: 'Late completion', value: selectedAllocation?.is_late_completion ? 'Yes' : 'No' },
          { label: 'Assigned Team', value: selectedAllocation?.assigned_users?.map((u) => u.name).join(', ') || '—' },
          { label: 'Due Date', value: selectedAllocation?.due_date ? new Date(selectedAllocation.due_date).toLocaleString() : '—' },
          { label: 'Started At', value: selectedAllocation?.started_at ? new Date(selectedAllocation.started_at).toLocaleString() : '—' },
          { label: 'Completed At', value: selectedAllocation?.completed_at ? new Date(selectedAllocation.completed_at).toLocaleString() : '—' },
          { label: 'Before Proof', value: selectedAllocation?.before_image_url ? 'Uploaded' : 'Not uploaded' },
          { label: 'After Proof', value: selectedAllocation?.after_image_url ? 'Uploaded' : 'Not uploaded' },
          { label: 'Execution notes', value: selectedAllocation?.execution_notes || '—' },
          { label: 'Not Completed Reason', value: selectedAllocation?.not_completed_reason || '—' },
          { label: 'Description', value: selectedAllocation?.description || '—' },
        ]}
        extra={
          selectedAllocation?.proofs && selectedAllocation.proofs.length > 0 ? (
            <div className="rounded-lg border border-dark-100 dark:border-white/10 bg-dark-50/40 dark:bg-white/[0.02] p-3">
              <p className="text-[10px] uppercase tracking-widest text-dark-500 mb-2">All proof images</p>
              <div className="flex flex-wrap gap-2">
                {selectedAllocation.proofs.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setProofPreviewUrl(p.image_url)}
                    className="relative w-16 h-16 rounded-lg border border-dark-200 dark:border-white/10 overflow-hidden"
                  >
                    <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                    <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[7px] text-white text-center uppercase">{p.category}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null
        }
      />
    </>
  );
}
