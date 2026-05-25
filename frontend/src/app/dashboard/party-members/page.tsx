'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { toast } from 'react-hot-toast';
import { showToast } from '@/lib/toast';
import Header from '@/components/Header';
import { partyMembersAPI, constituencyAPI } from '@/lib/api';
import { 
  Plus, Search, Edit3, Trash2, X, Loader2, UserPlus, 
  ChevronLeft, ChevronRight as ChevronRightIcon,
  Users, Eye, Image as ImageIcon, Sparkles, Filter,
  Award, MapPin, TrendingUp, BarChart3, HelpCircle, Activity
} from 'lucide-react';
import Modal from '@/components/Modal';
import { useSearchParams } from 'next/navigation';
import DetailsModal from '@/components/DetailsModal';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { format } from 'date-fns';
import { Pie, Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  ArcElement, Title, Tooltip, Legend, Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  ArcElement, Title, Tooltip, Legend, Filler
);

export interface PartyMember {
  id: number;
  full_name: string;
  phone: string;
  email: string | null;
  address: string | null;
  ward_id: number | null;
  booth_id: number | null;
  ward_number: string | null;
  booth_number: string | null;
  constituency_id: number | null;
  qualification: string | null;
  profession: string | null;
  age: number | null;
  gender: string | null;
  support_preference: string;
  photo_url: string | null;
  created_by_user_id: number | null;
  created_by_role: string;
  created_by_name: string;
  ward_name?: string;
  booth_name?: string;
  constituency_name?: string;
  created_at: string;
  updated_at: string;
}

function PartyMembersContent() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [members, setMembers] = useState<PartyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState<PartyMember | null>(null);
  const [selectedMember, setSelectedMember] = useState<PartyMember | null>(null);
  
  // Filters state
  const [search, setSearch] = useState('');
  const [wardFilter, setWardFilter] = useState('');
  const [supportFilter, setSupportFilter] = useState('');
  const [creatorRoleFilter, setCreatorRoleFilter] = useState('');
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  
  // Form options list
  const [wards, setWards] = useState<any[]>([]);
  const [booths, setBooths] = useState<any[]>([]);
  
  // Create / Edit Form State
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    address: '',
    ward_id: '',
    booth_id: '',
    qualification: '',
    profession: '',
    age: '',
    gender: '',
    support_preference: 'Neutral',
    photo_url: '',
  });

  // Analytics States
  const [activeTab, setActiveTab] = useState<'list' | 'analytics'>('list');
  const [summaryData, setSummaryData] = useState<any>(null);
  const [topPerformers, setTopPerformers] = useState<any[]>([]);
  const [wardsStats, setWardsStats] = useState<any[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [selectedCreatorId, setSelectedCreatorId] = useState<number | null>(null);
  const [creatorDetails, setCreatorDetails] = useState<any>(null);
  const [creatorLoading, setCreatorLoading] = useState(false);

  const searchParams = useSearchParams();
  const queryWardId = searchParams.get('ward_id');

  // Check if role is allowed
  const isAllowed = user && ['super_admin', 'mla', 'campaign_manager', 'ward_head'].includes(user.role_name);

  // Load Wards list for filters and forms
  const loadWards = async () => {
    try {
      const res = await constituencyAPI.getWards();
      setWards(res.data.data || []);
    } catch (err) {
      console.error('Error loading wards:', err);
    }
  };

  // Load Booths list for a specific ward
  const loadBooths = async (wardId: number) => {
    try {
      const res = await constituencyAPI.getBooths(wardId);
      setBooths(res.data.data || []);
    } catch (err) {
      console.error('Error loading booths:', err);
    }
  };

  // Analytics Load Action
  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const [summaryRes, performersRes, wardsRes] = await Promise.all([
        partyMembersAPI.getSummary(),
        partyMembersAPI.getTopPerformers({ limit: 10 }),
        partyMembersAPI.getWards()
      ]);
      setSummaryData(summaryRes.data.data);
      setTopPerformers(performersRes.data.data || []);
      setWardsStats(wardsRes.data.data || []);
    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  const loadCreatorDetails = async (id: number) => {
    setSelectedCreatorId(id);
    setCreatorLoading(true);
    try {
      const res = await partyMembersAPI.getCreatorDetails(id);
      setCreatorDetails(res.data.data);
    } catch (err) {
      console.error('Error fetching creator details:', err);
      toast.error('Failed to load performance details.');
    } finally {
      setCreatorLoading(false);
    }
  };

  // Fetch Party Members from API
  const loadMembers = useCallback(async (page = 1) => {
    if (!isAllowed) return;
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 15 };
      if (search) params.search = search;
      if (wardFilter) params.ward_id = wardFilter;
      if (supportFilter) params.support_preference = supportFilter;
      if (creatorRoleFilter) params.creator_role = creatorRoleFilter;

      const res = await partyMembersAPI.getAll(params);
      setMembers(res.data.data || []);
      setMeta(res.data.meta || { total: 0, page: 1, totalPages: 1 });
    } catch (err: any) {
      console.error('Error loading party members:', err);
      toast.error(err.response?.data?.message || 'Error fetching party members');
    } finally {
      setLoading(false);
    }
  }, [search, wardFilter, supportFilter, creatorRoleFilter, isAllowed]);

  // Load wards initially
  useEffect(() => {
    if (isAllowed) {
      loadWards();
      loadAnalytics();
    }
  }, [isAllowed, loadAnalytics]);

  // Set default ward filter from search query parameters if available
  useEffect(() => {
    if (queryWardId) {
      setWardFilter(queryWardId);
    }
  }, [queryWardId]);

  // Load members when filters or pagination page changes
  useEffect(() => {
    loadMembers(meta.page);
  }, [loadMembers, meta.page]);

  // Load booths dynamically when ward changes in the creation/edit form
  useEffect(() => {
    if (form.ward_id) {
      loadBooths(parseInt(form.ward_id));
    } else {
      setBooths([]);
    }
  }, [form.ward_id]);

  const openCreate = () => {
    setEditingMember(null);
    setForm({
      full_name: '',
      phone: '',
      email: '',
      address: '',
      ward_id: '',
      booth_id: '',
      qualification: '',
      profession: '',
      age: '',
      gender: '',
      support_preference: 'Neutral',
      photo_url: '',
    });
    setShowModal(true);
  };

  const openEdit = (member: PartyMember) => {
    setEditingMember(member);
    setForm({
      full_name: member.full_name,
      phone: member.phone,
      email: member.email || '',
      address: member.address || '',
      ward_id: member.ward_id ? String(member.ward_id) : '',
      booth_id: member.booth_id ? String(member.booth_id) : '',
      qualification: member.qualification || '',
      profession: member.profession || '',
      age: member.age ? String(member.age) : '',
      gender: member.gender || '',
      support_preference: member.support_preference || 'Neutral',
      photo_url: member.photo_url || '',
    });
    setShowModal(true);
  };

  // Base64 Photo Upload Handler
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Type validation
    if (!file.type.startsWith('image/')) {
      toast.error('Only image files are allowed.');
      return;
    }

    // Size validation: 5MB
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setForm(prev => ({ ...prev, photo_url: String(reader.result) }));
    };
    reader.readAsDataURL(file);
  };

  // Create or Update Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name || !form.phone || !form.ward_id) {
      toast.error('Name, Phone Number, and Ward are required.');
      return;
    }

    try {
      const payload = {
        full_name: form.full_name,
        phone: form.phone,
        email: form.email || null,
        address: form.address || null,
        ward_id: form.ward_id ? parseInt(form.ward_id) : null,
        booth_id: form.booth_id ? parseInt(form.booth_id) : null,
        qualification: form.qualification || null,
        profession: form.profession || null,
        age: form.age ? parseInt(form.age) : null,
        gender: form.gender || null,
        support_preference: form.support_preference || 'Neutral',
        photo_url: form.photo_url || null,
      };

      if (editingMember) {
        await partyMembersAPI.update(editingMember.id, payload);
        toast.success('Party Member updated successfully');
      } else {
        await partyMembersAPI.create(payload);
        toast.success('Party Member registered successfully');
      }
      setShowModal(false);
      loadMembers(meta.page);
      loadAnalytics();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Error saving party member details');
    }
  };

  const handleDelete = async (id: number) => {
    showToast.confirm(
      'Remove Party Member',
      'Are you sure you want to remove this party member record? This will permanently delete their profile.',
      async () => {
        try {
          await partyMembersAPI.delete(id);
          loadMembers(meta.page);
          loadAnalytics();
          toast.success('Party Member record deleted');
        } catch (err: any) {
          console.error(err);
          toast.error(err.response?.data?.message || 'Failed to delete party member record');
        }
      },
      'Delete'
    );
  };

  // Visual pills mapping for support preference
  const getSupportBadgeStyle = (preference: string) => {
    switch (preference.toLowerCase()) {
      case 'bjp':
        return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20';
      case 'samajwadi party':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
      case 'congress':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20';
      case 'bsp':
        return 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20';
      case 'aap':
        return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20';
      case 'neutral':
        return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20';
      case 'undecided':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20';
      default:
        return 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20';
    }
  };

  const getSupportDotStyle = (preference: string) => {
    switch (preference.toLowerCase()) {
      case 'bjp': return 'bg-orange-500';
      case 'samajwadi party': return 'bg-emerald-500';
      case 'congress': return 'bg-blue-500';
      case 'bsp': return 'bg-indigo-500';
      case 'aap': return 'bg-yellow-500';
      case 'neutral': return 'bg-slate-500';
      case 'undecided': return 'bg-purple-500';
      default: return 'bg-teal-500';
    }
  };

  // Format creators role label
  const formatRole = (role: string) => {
    return role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };


  // Memoized Chart Configs
  const chartDefaults = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: { top: 10, bottom: 0, left: 0, right: 10 }
    },
    plugins: {
      legend: { 
        display: false,
      },
      tooltip: {
        backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
        titleColor: theme === 'dark' ? '#f1f5f9' : '#1e293b',
        bodyColor: theme === 'dark' ? '#94a3b8' : '#475569',
        borderColor: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
        borderWidth: 1,
        padding: 14,
        cornerRadius: 16,
        usePointStyle: true,
        titleFont: { size: 13, weight: 700 },
        bodyFont: { size: 12 },
        boxPadding: 6,
        shadowBlur: 10,
        shadowColor: 'rgba(0,0,0,0.1)',
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { 
          color: theme === 'dark' ? '#64748b' : '#334155', 
          font: { size: 11, weight: 400, family: "'Inter', sans-serif" },
          padding: 10
        },
      },
      y: {
        beginAtZero: true,
        grid: { 
          color: theme === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.03)',
          drawTicks: false,
        },
        ticks: { 
          color: theme === 'dark' ? '#64748b' : '#334155', 
          font: { size: 11, weight: 400, family: "'Inter', sans-serif" },
          padding: 12,
          maxTicksLimit: 6
        },
        border: { display: false },
      },
    },
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
  }), [theme]);

  const pieOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'right' as const,
        labels: {
          color: theme === 'dark' ? '#94a3b8' : '#475569',
          font: { size: 11, weight: 600, family: "'Inter', sans-serif" },
          boxWidth: 10,
          padding: 10
        }
      },
      tooltip: chartDefaults.plugins.tooltip
    }
  }), [theme, chartDefaults]);

  // Clean empty state fallback component
  const EmptyState = ({ message = "No analytics data available" }: { message?: string }) => (
    <div className="flex flex-col items-center justify-center py-10 px-4 h-full min-h-[180px] text-center">
      <div className="w-12 h-12 rounded-xl bg-dark-50 dark:bg-dark-800/40 flex items-center justify-center text-dark-400 mb-3">
        <BarChart3 className="w-5 h-5" />
      </div>
      <p className="text-xs font-semibold text-dark-500 uppercase tracking-wider">{message}</p>
    </div>
  );

  // Memoized Chart data packages
  const supportChartData = useMemo(() => {
    const dataList = summaryData?.charts?.support_distribution || [];
    return {
      labels: dataList.map((d: any) => d.support_preference),
      datasets: [{
        data: dataList.map((d: any) => d.count),
        backgroundColor: dataList.map((d: any) => {
          switch (d.support_preference?.toLowerCase()) {
            case 'bjp': return '#f97316';
            case 'samajwadi party': return '#10b981';
            case 'congress': return '#3b82f6';
            case 'bsp': return '#6366f1';
            case 'aap': return '#eab308';
            case 'neutral': return '#64748b';
            case 'undecided': return '#a855f7';
            default: return '#14b8a6';
          }
        }),
        borderWidth: 0
      }]
    };
  }, [summaryData]);

  const growthChartData = useMemo(() => {
    const dataList = summaryData?.charts?.monthly_growth || [];
    return {
      labels: dataList.map((d: any) => {
        try {
          return format(new Date(d.month), 'MMM yyyy');
        } catch {
          return String(d.month).slice(0, 7);
        }
      }),
      datasets: [{
        label: 'Member Growth',
        data: dataList.map((d: any) => d.count),
        borderColor: '#f97316',
        backgroundColor: 'rgba(249, 115, 22, 0.12)',
        fill: true,
        tension: 0.35,
        pointRadius: 4,
        pointBackgroundColor: '#f97316',
        pointBorderColor: theme === 'dark' ? '#0f172a' : '#ffffff',
        pointBorderWidth: 2,
        pointHoverRadius: 6,
        borderWidth: 3
      }]
    };
  }, [summaryData, theme]);

  const wardChartData = useMemo(() => {
    const dataList = wardsStats?.slice(0, 10) || [];
    return {
      labels: dataList.map((w: any) => w.ward_name),
      datasets: [{
        label: 'Members',
        data: dataList.map((w: any) => w.total_members),
        backgroundColor: '#6366f1',
        borderRadius: 6,
        borderWidth: 0,
        maxBarThickness: 32
      }]
    };
  }, [wardsStats]);

  const creatorChartData = useMemo(() => {
    const dataList = topPerformers?.slice(0, 10) || [];
    return {
      labels: dataList.map((p: any) => p.user_name),
      datasets: [{
        label: 'Members Added',
        data: dataList.map((p: any) => p.total_members_added),
        backgroundColor: '#10b981',
        borderRadius: 6,
        borderWidth: 0,
        maxBarThickness: 32
      }]
    };
  }, [topPerformers]);

  const statCards = useMemo(() => {
    return [
      { label: 'Total Party Members', value: summaryData?.total_members ?? 0, icon: Users, color: 'text-blue-600 dark:text-blue-400', bgIcon: 'bg-blue-500/10 dark:bg-blue-500/12', glow: 'shadow-blue-500/20' },
      { label: 'BJP Supporters', value: summaryData?.bjp_supporters ?? 0, icon: Sparkles, color: 'text-orange-500 dark:text-orange-400', bgIcon: 'bg-orange-500/10 dark:bg-orange-500/12', glow: 'shadow-orange-500/20' },
      { label: 'Opposition Supporters', value: summaryData?.opposition_supporters ?? 0, icon: Users, color: 'text-red-500 dark:text-red-400', bgIcon: 'bg-red-500/10 dark:bg-red-500/12', glow: 'shadow-red-500/20' },
      { label: 'Neutral / Undecided', value: summaryData?.neutral_undecided ?? 0, icon: HelpCircle, color: 'text-slate-500 dark:text-slate-400', bgIcon: 'bg-slate-500/10 dark:bg-slate-500/12', glow: 'shadow-slate-500/20' },
      { label: 'Active Wards', value: summaryData?.active_wards ?? 0, icon: MapPin, color: 'text-purple-500 dark:text-purple-400', bgIcon: 'bg-purple-500/10 dark:bg-purple-500/12', glow: 'shadow-purple-500/20' },
      { label: 'Top Performer', value: summaryData?.top_performer?.name && summaryData.top_performer.name !== 'None' ? `${summaryData.top_performer.name} (${summaryData.top_performer.count})` : '—', icon: Award, color: 'text-emerald-500 dark:text-emerald-400', bgIcon: 'bg-emerald-500/10 dark:bg-emerald-500/12', glow: 'shadow-emerald-500/20' }
    ];
  }, [summaryData]);

  // Access Denied screen for Booth Worker
  if (!isAllowed) {
    return (
      <>
        <Header title="Access Restricted" subtitle="Field Operations Restriction" />
        <div className="dashboard-container max-w-[600px] mx-auto text-center py-20">
          <div className="glass-card p-8 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500">
              <Users className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-dark-900 dark:text-white">Permission Required</h2>
            <p className="text-sm text-dark-500 leading-relaxed">
              Your role (<strong>{user?.role_name?.replace(/_/g, ' ')}</strong>) is not authorized to manage or view Party Supporter records. Please contact your Campaign Manager if you require access.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Party Members" subtitle="Party member database, demographics, and support tracking" />
      <div className="dashboard-container">
        
        {/* Summary Aggregations Cards */}
        {analyticsLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5 mb-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="glass-card p-5 animate-pulse">
                <div className="w-12 h-12 rounded-2xl bg-dark-100 dark:bg-dark-800 mb-5" />
                <div className="h-8 w-20 bg-dark-100 dark:bg-dark-800 rounded mb-2" />
                <div className="h-4 w-28 bg-dark-100 dark:bg-dark-800 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5 mb-8">
            {statCards.map((card) => (
              <div key={card.label} className={`glass-card-hover p-5 relative overflow-hidden group border border-dark-100/50 dark:border-white/5 transition-all duration-300 hover:scale-[1.02] hover:${card.glow} shadow-lg`}>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${card.bgIcon} mb-5 group-hover:scale-110 transition-transform duration-300`}>
                  <card.icon className={`w-6 h-6 ${card.color}`} />
                </div>
                <div className="text-xl font-bold text-dark-900 dark:text-white tracking-tight leading-none truncate" title={String(card.value)}>
                  {card.value}
                </div>
                <div className="text-[10px] text-dark-500 font-medium uppercase tracking-[2px] mt-2 whitespace-nowrap leading-none opacity-80 truncate">{card.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* View Switcher Tabs */}
        <div className="flex border-b border-dark-100 dark:border-white/5 mb-6">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-6 py-3 text-sm font-semibold transition-all border-b-2 -mb-[2px] ${
              activeTab === 'list'
                ? 'border-saffron-500 text-saffron-500 font-bold'
                : 'border-transparent text-dark-500 hover:text-dark-700 dark:hover:text-dark-300'
            }`}
          >
            Supporters Database
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-6 py-3 text-sm font-semibold transition-all border-b-2 -mb-[2px] ${
              activeTab === 'analytics'
                ? 'border-saffron-500 text-saffron-500 font-bold'
                : 'border-transparent text-dark-500 hover:text-dark-700 dark:hover:text-dark-300'
            }`}
          >
            Analytics & Reports
          </button>
        </div>

        {activeTab === 'analytics' ? (
          analyticsLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-saffron-500" />
              <span className="text-xs font-medium text-dark-500 uppercase tracking-widest">Generating Analytics Reports...</span>
            </div>
          ) : (
            <div className="space-y-6 pb-10">
              
              {/* Row 1 Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="glass-card p-6 border border-dark-100/50 dark:border-white/5 shadow-xl">
                  <h3 className="text-base font-medium text-dark-900 dark:text-white mb-6 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-saffron-500" /> Supporter Sentiment
                  </h3>
                  {(!summaryData?.charts?.support_distribution || summaryData.charts.support_distribution.length === 0) ? (
                    <EmptyState message="No sentiment data available" />
                  ) : (
                    <div className="h-[220px]">
                      <Pie data={supportChartData} options={pieOptions} />
                    </div>
                  )}
                </div>

                <div className="glass-card p-6 lg:col-span-2 border border-dark-100/50 dark:border-white/5 shadow-xl">
                  <h3 className="text-base font-medium text-dark-900 dark:text-white mb-6 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-saffron-500" /> Registration Growth
                  </h3>
                  {(!summaryData?.charts?.monthly_growth || summaryData.charts.monthly_growth.length === 0) ? (
                    <EmptyState message="No registration data available" />
                  ) : (
                    <div className="h-[220px]">
                      <Line data={growthChartData} options={chartDefaults} />
                    </div>
                  )}
                </div>
              </div>

              {/* Row 2 Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass-card p-6 border border-dark-100/50 dark:border-white/5 shadow-xl">
                  <h3 className="text-base font-medium text-dark-900 dark:text-white mb-6 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-indigo-500" /> Ward-wise Member Counts (Top 10)
                  </h3>
                  {wardsStats.length === 0 ? (
                    <EmptyState message="No ward data available" />
                  ) : (
                    <div className="h-[220px]">
                      <Bar data={wardChartData} options={chartDefaults} />
                    </div>
                  )}
                </div>

                <div className="glass-card p-6 border border-dark-100/50 dark:border-white/5 shadow-xl">
                  <h3 className="text-base font-medium text-dark-900 dark:text-white mb-6 flex items-center gap-2">
                    <Award className="w-5 h-5 text-emerald-500" /> Top Performers Output (Top 10)
                  </h3>
                  {topPerformers.length === 0 ? (
                    <EmptyState message="No performers data available" />
                  ) : (
                    <div className="h-[220px]">
                      <Bar data={creatorChartData} options={chartDefaults} />
                    </div>
                  )}
                </div>
              </div>

              {/* Tables Section */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="glass-card overflow-hidden border border-dark-100/50 dark:border-white/5 shadow-xl">
                  <div className="p-6 border-b border-dark-100 dark:border-white/5 flex items-center justify-between bg-dark-50/50 dark:bg-white/[0.02]">
                    <h3 className="text-base font-medium text-dark-900 dark:text-white flex items-center gap-2">
                      <Award className="w-5 h-5 text-emerald-500" /> Top Performer Rankings
                    </h3>
                  </div>
                  <div className="p-4 overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs text-dark-800 dark:text-dark-300">
                      <thead>
                        <tr className="border-b border-dark-100 dark:border-white/5 text-dark-500 font-bold uppercase tracking-wider">
                          <th className="py-2.5">Rank</th>
                          <th className="py-2.5">User</th>
                          <th className="py-2.5">Role</th>
                          <th className="py-2.5">Added</th>
                          <th className="py-2.5">BJP Conv.</th>
                          <th className="py-2.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark-100 dark:divide-white/5">
                        {topPerformers.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center py-8 text-dark-500">No performers found.</td>
                          </tr>
                        ) : (
                          topPerformers.map((worker) => (
                            <tr key={worker.user_id} className="hover:bg-dark-50/50 dark:hover:bg-white/[0.01]">
                              <td className="py-3 font-bold text-dark-900 dark:text-white">{worker.rank}</td>
                              <td className="py-3 font-semibold text-dark-900 dark:text-white">{worker.user_name}</td>
                              <td className="py-3 capitalize text-dark-500">{worker.role?.replace(/_/g, ' ')}</td>
                              <td className="py-3 font-bold text-emerald-600 dark:text-emerald-400">{worker.total_members_added}</td>
                              <td className="py-3 font-bold text-orange-500">{worker.bjp_supporters_added} ({worker.join_rate}%)</td>
                              <td className="py-3 text-right">
                                <button
                                  onClick={() => loadCreatorDetails(worker.user_id)}
                                  className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-saffron-500 bg-saffron-500/10 hover:bg-saffron-500/20 rounded-md transition-all"
                                >
                                  View Details
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="glass-card overflow-hidden border border-dark-100/50 dark:border-white/5 shadow-xl">
                  <div className="p-6 border-b border-dark-100 dark:border-white/5 flex items-center justify-between bg-dark-50/50 dark:bg-white/[0.02]">
                    <h3 className="text-base font-medium text-dark-900 dark:text-white flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-indigo-500" /> Ward-wise Performance
                    </h3>
                  </div>
                  <div className="p-4 overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs text-dark-800 dark:text-dark-300">
                      <thead>
                        <tr className="border-b border-dark-100 dark:border-white/5 text-dark-500 font-bold uppercase tracking-wider">
                          <th className="py-2.5">Ward Name</th>
                          <th className="py-2.5">Total Members</th>
                          <th className="py-2.5">BJP</th>
                          <th className="py-2.5">Opposition</th>
                          <th className="py-2.5">Neutral</th>
                          <th className="py-2.5">Growth</th>
                          <th className="py-2.5 text-right">Top Creator</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark-100 dark:divide-white/5">
                        {wardsStats.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="text-center py-8 text-dark-500">No ward summary data available.</td>
                          </tr>
                        ) : (
                          wardsStats.map((ward) => (
                            <tr key={ward.ward_id} className="hover:bg-dark-50/50 dark:hover:bg-white/[0.01]">
                              <td className="py-3 font-semibold text-dark-900 dark:text-white">{ward.ward_name}</td>
                              <td className="py-3 font-bold text-dark-900 dark:text-white">{ward.total_members}</td>
                              <td className="py-3 font-bold text-orange-500">{ward.bjp_supporters}</td>
                              <td className="py-3 font-bold text-red-500">{ward.opposition_supporters}</td>
                              <td className="py-3 font-bold text-slate-500">{ward.neutral}</td>
                              <td className="py-3 font-bold text-emerald-600 dark:text-emerald-400">+{ward.growth_rate}%</td>
                              <td className="py-3 text-right text-dark-950 dark:text-dark-100 font-medium truncate max-w-[120px]" title={ward.top_creator}>{ward.top_creator}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

            </div>
          )
        ) : (
          <>
            {/* Header Title with Button */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-dark-900 dark:text-white font-serif">Supporters & Members</h2>
                <p className="text-xs text-dark-500 font-semibold">{meta.total} registered members</p>
              </div>
              <button onClick={openCreate} className="btn-primary">
                <UserPlus className="w-4 h-4" /> Register Party Member
              </button>
            </div>

            {/* Filter Toolbar */}
            <div className="glass-card p-4 mb-6 space-y-4">
              <div className="flex flex-wrap gap-3">
                
                {/* Search Input */}
                <div className="relative flex-1 min-w-[280px]">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500 pointer-events-none" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setMeta(prev => ({ ...prev, page: 1 })); }}
                    placeholder="Search by name, phone number..."
                    className="form-input pl-10"
                  />
                </div>

                {/* Ward Selector Dropdown */}
                <select
                  value={wardFilter}
                  onChange={(e) => { setWardFilter(e.target.value); setMeta(prev => ({ ...prev, page: 1 })); }}
                  className="form-input max-w-[200px]"
                >
                  <option value="">All Wards</option>
                  {wards.map(w => (
                    <option key={w.id} value={w.id}>Ward {w.number} - {w.name}</option>
                  ))}
                </select>

                {/* Support Preference Dropdown */}
                <select
                  value={supportFilter}
                  onChange={(e) => { setSupportFilter(e.target.value); setMeta(prev => ({ ...prev, page: 1 })); }}
                  className="form-input max-w-[200px]"
                >
                  <option value="">All Preferences</option>
                  <option value="Neutral">Neutral</option>
                  <option value="BJP">BJP</option>
                  <option value="Samajwadi Party">Samajwadi Party</option>
                  <option value="Congress">Congress</option>
                  <option value="BSP">BSP</option>
                  <option value="AAP">AAP</option>
                  <option value="Undecided">Undecided</option>
                  <option value="Other">Other</option>
                </select>

                {/* Creator Role Dropdown */}
                <select
                  value={creatorRoleFilter}
                  onChange={(e) => { setCreatorRoleFilter(e.target.value); setMeta(prev => ({ ...prev, page: 1 })); }}
                  className="form-input max-w-[200px]"
                >
                  <option value="">All Creators</option>
                  <option value="super_admin">Super Admin</option>
                  <option value="mla">MLA / Candidate</option>
                  <option value="campaign_manager">Campaign Manager</option>
                  <option value="ward_head">Ward Head</option>
                </select>

                {/* Reset Filters Option */}
                {(search || wardFilter || supportFilter || creatorRoleFilter) && (
                  <button 
                    onClick={() => { setSearch(''); setWardFilter(''); setSupportFilter(''); setCreatorRoleFilter(''); setMeta(prev => ({ ...prev, page: 1 })); }}
                    className="px-4 py-2 text-xs font-semibold text-red-500 hover:bg-red-500/10 rounded-lg transition-colors border border-red-500/20"
                  >
                    Clear Filters
                  </button>
                )}

              </div>
            </div>

            {/* Members Listing Table */}
            <div className="glass-card table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-[30%] min-w-[220px]">Member</th>
                    <th className="min-w-[120px]">Phone</th>
                    <th className="min-w-[150px]">Geography</th>
                    <th className="min-w-[120px]">Demographics</th>
                    <th className="min-w-[155px]">Support Preference</th>
                    <th className="min-w-[150px]">Registered By</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-100 dark:divide-white/5">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-20">
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 className="w-8 h-8 animate-spin text-saffron-500" />
                          <span className="text-xs font-medium text-dark-500 uppercase tracking-widest">Loading supporters registry...</span>
                        </div>
                      </td>
                    </tr>
                  ) : members.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-16 text-dark-500 font-medium">
                        No party members found matching the criteria.
                      </td>
                    </tr>
                  ) : (
                    members.map((member) => (
                      <tr key={member.id} className="hover:bg-dark-50/50 dark:hover:bg-white/[0.02] transition-colors">
                        
                        {/* Identity (Photo/Initials + Name/Email) */}
                        <td>
                          <div 
                            className="flex items-center gap-3 cursor-pointer group/user"
                            onClick={() => setSelectedMember(member)}
                          >
                            {member.photo_url ? (
                              <div className="w-10 h-10 rounded-xl overflow-hidden border border-dark-200 dark:border-white/10 flex-shrink-0 relative group-hover/user:scale-105 transition-transform shadow-md">
                                <img src={member.photo_url} alt={member.full_name} className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-saffron-500 to-amber-600 flex items-center justify-center text-white text-xs font-extrabold flex-shrink-0 group-hover/user:scale-105 transition-transform shadow-md shadow-saffron-500/10">
                                {member.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="font-bold text-dark-900 dark:text-dark-100 truncate group-hover/user:text-saffron-500 transition-colors leading-tight">
                                {member.full_name}
                              </div>
                              <div className="text-[10px] font-bold text-dark-500 truncate uppercase mt-0.5 tracking-wider">
                                {member.email || 'No email'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Phone */}
                        <td className="text-dark-700 dark:text-dark-400 font-semibold text-sm">
                          {member.phone}
                        </td>

                        {/* Ward / Booth details */}
                        <td>
                          <div className="text-xs font-bold text-dark-900 dark:text-dark-300 truncate">
                            {member.ward_name ? `Ward: ${member.ward_name}` : `Ward No: ${member.ward_number || '—'}`}
                          </div>
                          <div className="text-[10px] font-medium text-dark-500 truncate mt-0.5">
                            {member.booth_name ? `Booth: ${member.booth_name}` : member.booth_number ? `Booth No: ${member.booth_number}` : 'No booth assigned'}
                          </div>
                        </td>

                        {/* Age / Profession */}
                        <td>
                          <div className="text-xs font-bold text-dark-900 dark:text-dark-300">
                            {member.profession || '—'}
                          </div>
                          <div className="text-[10px] text-dark-500 font-medium capitalize mt-0.5">
                            {member.gender || '—'} {member.age ? `• ${member.age} yrs` : ''}
                          </div>
                        </td>

                        {/* Support Preference badge */}
                        <td>
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getSupportBadgeStyle(member.support_preference)}`}>
                            {member.support_preference}
                          </span>
                        </td>

                        {/* Creator details */}
                        <td>
                          <div className="font-bold text-dark-900 dark:text-dark-200 text-xs truncate">
                            {member.created_by_name}
                          </div>
                          <div className="text-[9px] font-black text-dark-500 uppercase tracking-widest mt-0.5">
                            {formatRole(member.created_by_role)}
                          </div>
                        </td>

                        {/* Actions */}
                        <td>
                          <div className="flex gap-2 justify-end">
                            <button 
                              onClick={() => setSelectedMember(member)} 
                              className="p-2 rounded-lg bg-dark-100 dark:bg-dark-800 text-dark-600 dark:text-dark-400 hover:bg-saffron-500/10 hover:text-saffron-500 transition-all" 
                              title="View complete profile"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => openEdit(member)} 
                              className="p-2 rounded-lg bg-dark-100 dark:bg-dark-800 text-dark-600 dark:text-dark-400 hover:bg-saffron-500/10 hover:text-saffron-500 transition-all"
                              title="Edit member"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => handleDelete(member.id)} 
                              className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all"
                              title="Delete member"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>

                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {!loading && meta.totalPages > 1 && (
              <div className="px-6 py-4 flex items-center justify-between border-t border-dark-100 dark:border-white/5 bg-dark-50/30 dark:bg-white/[0.01]">
                <p className="text-xs text-dark-500 font-medium">
                  Page {meta.page} of {meta.totalPages} • Total {meta.total} records
                </p>
                <div className="flex gap-2">
                  <button 
                    disabled={meta.page <= 1}
                    onClick={() => setMeta(prev => ({ ...prev, page: prev.page - 1 }))}
                    className="p-2 rounded-lg border border-dark-100 dark:border-white/5 bg-white dark:bg-dark-900 disabled:opacity-30 transition-all hover:bg-dark-50 dark:hover:bg-dark-800"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button 
                    disabled={meta.page >= meta.totalPages}
                    onClick={() => setMeta(prev => ({ ...prev, page: prev.page + 1 }))}
                    className="p-2 rounded-lg border border-dark-100 dark:border-white/5 bg-white dark:bg-dark-900 disabled:opacity-30 transition-all hover:bg-dark-50 dark:hover:bg-dark-800"
                  >
                    <ChevronRightIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

      </div>

      {/* Creation and Modification Form Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingMember ? 'Edit Party Member' : 'Register Party Member'}
        subtitle={editingMember ? 'Update party supporter details and preference' : 'Fill in the details to register a new supporter or party worker'}
        maxWidth="max-w-[760px]"
        footer={(
          <div className="flex gap-3 justify-end w-full">
            <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2.5 rounded-xl border border-dark-200 dark:border-white/10 text-dark-500 font-medium hover:bg-dark-50 transition-all">Cancel</button>
            <button type="submit" form="member-form" className="px-8 py-2.5 rounded-xl bg-saffron-500 text-dark-950 font-medium shadow-lg shadow-saffron-500/20 hover:scale-105 active:scale-95 transition-all">
              {editingMember ? 'Save Changes' : 'Register Supporter'}
            </button>
          </div>
        )}
      >
        <form id="member-form" onSubmit={handleSubmit} className="space-y-6">
          
          {/* Photo upload box */}
          <div className="space-y-2">
            <label className="block text-[10px] font-medium text-dark-400 uppercase tracking-widest px-1">Profile Photo (Max 5MB)</label>
            <div className="flex items-center gap-4 p-4 rounded-xl border border-dashed border-dark-200 dark:border-white/10 bg-dark-50/50 dark:bg-white/[0.01]">
              <div className="relative w-16 h-16 rounded-xl border border-dark-200 dark:border-white/10 overflow-hidden bg-dark-100 dark:bg-dark-900 flex items-center justify-center flex-shrink-0">
                {form.photo_url ? (
                  <img src={form.photo_url} alt="Supporter Profile" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-6 h-6 text-dark-400" />
                )}
                {form.photo_url && (
                  <button 
                    type="button" 
                    onClick={() => setForm(prev => ({ ...prev, photo_url: '' }))} 
                    className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full p-0.5 hover:scale-110 transition-transform"
                    title="Remove image"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="flex-1">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handlePhotoUpload} 
                  className="hidden" 
                  id="modal-photo-file" 
                />
                <label 
                  htmlFor="modal-photo-file"
                  className="px-4 py-2 text-xs font-semibold bg-dark-100 dark:bg-dark-800 hover:bg-saffron-500/10 hover:text-saffron-500 rounded-lg transition-colors cursor-pointer border border-dark-200 dark:border-white/5 inline-block"
                >
                  Choose Image File
                </label>
                <p className="text-[10px] text-dark-500 mt-1">Accepts PNG, JPG, GIF up to 5MB. Photo is optional.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-medium text-dark-400 uppercase tracking-widest px-1">Full Name *</label>
              <input 
                value={form.full_name} 
                onChange={e => setForm({...form, full_name: e.target.value})} 
                className="form-input" 
                placeholder="e.g. Rahul Kumar" 
                required 
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-medium text-dark-400 uppercase tracking-widest px-1">Phone Number *</label>
              <input 
                value={form.phone} 
                onChange={e => setForm({...form, phone: e.target.value})} 
                className="form-input" 
                placeholder="+91 XXXXXXXXXX" 
                required 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-medium text-dark-400 uppercase tracking-widest px-1">Email Address</label>
              <input 
                type="email" 
                value={form.email} 
                onChange={e => setForm({...form, email: e.target.value})} 
                className="form-input" 
                placeholder="e.g. rahul@example.com" 
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-medium text-dark-400 uppercase tracking-widest px-1">Home Address</label>
              <input 
                value={form.address} 
                onChange={e => setForm({...form, address: e.target.value})} 
                className="form-input" 
                placeholder="e.g. Ward 4, Building 12, Main Street" 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-medium text-dark-400 uppercase tracking-widest px-1">Assigned Ward *</label>
              <select 
                value={form.ward_id} 
                onChange={e => setForm({...form, ward_id: e.target.value, booth_id: ''})} 
                className="form-input" 
                required
              >
                <option value="">Select Ward</option>
                {wards.map(w => (
                  <option key={w.id} value={w.id}>Ward {w.number} - {w.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-medium text-dark-400 uppercase tracking-widest px-1">Assigned Booth (Optional)</label>
              <select 
                value={form.booth_id} 
                onChange={e => setForm({...form, booth_id: e.target.value})} 
                className="form-input" 
                disabled={!form.ward_id}
              >
                <option value="">Select Booth</option>
                {booths.map(b => (
                  <option key={b.id} value={b.id}>Booth {b.number} - {b.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-medium text-dark-400 uppercase tracking-widest px-1">Qualification</label>
              <input 
                value={form.qualification} 
                onChange={e => setForm({...form, qualification: e.target.value})} 
                className="form-input" 
                placeholder="e.g. Graduate, Intermediate" 
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-medium text-dark-400 uppercase tracking-widest px-1">Profession / Occupation</label>
              <input 
                value={form.profession} 
                onChange={e => setForm({...form, profession: e.target.value})} 
                className="form-input" 
                placeholder="e.g. Farmer, Shop Owner, Teacher" 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-medium text-dark-400 uppercase tracking-widest px-1">Age</label>
              <input 
                type="number" 
                value={form.age} 
                onChange={e => setForm({...form, age: e.target.value})} 
                className="form-input" 
                placeholder="e.g. 28" 
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-medium text-dark-400 uppercase tracking-widest px-1">Gender</label>
              <select 
                value={form.gender} 
                onChange={e => setForm({...form, gender: e.target.value})} 
                className="form-input"
              >
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-medium text-dark-400 uppercase tracking-widest px-1">Support Preference</label>
              <select 
                value={form.support_preference} 
                onChange={e => setForm({...form, support_preference: e.target.value})} 
                className="form-input"
              >
                <option value="Neutral">Neutral</option>
                <option value="BJP">BJP</option>
                <option value="Samajwadi Party">Samajwadi Party</option>
                <option value="Congress">Congress</option>
                <option value="BSP">BSP</option>
                <option value="AAP">AAP</option>
                <option value="Undecided">Undecided</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

        </form>
      </Modal>

      {/* Details View Modal */}
      <Modal
        isOpen={!!selectedMember}
        onClose={() => setSelectedMember(null)}
        title="Party Member Profile"
        subtitle="Identity, demographic insights, and geographical mapping"
        maxWidth="max-w-[760px]"
        footer={(
          <button type="button" onClick={() => setSelectedMember(null)} className="btn-secondary min-w-[120px]">
            Close
          </button>
        )}
      >
        {selectedMember && (
          <div className="space-y-6">
            
            {/* Visual Header Profile Box */}
            <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl border border-dark-100 dark:border-white/10 bg-dark-50/40 dark:bg-white/[0.02]">
              {selectedMember.photo_url ? (
                <div className="w-20 h-20 rounded-2xl overflow-hidden border border-dark-200 dark:border-white/10 shadow-md">
                  <img src={selectedMember.photo_url} alt={selectedMember.full_name} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-saffron-500 to-amber-600 flex items-center justify-center text-white text-2xl font-extrabold shadow-md shadow-saffron-500/10">
                  {selectedMember.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="text-center sm:text-left">
                <h3 className="text-lg font-bold text-dark-900 dark:text-white flex items-center gap-2">
                  {selectedMember.full_name}
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${getSupportBadgeStyle(selectedMember.support_preference)}`}>
                    {selectedMember.support_preference}
                  </span>
                </h3>
                <p className="text-xs text-dark-500 font-medium mt-1">Phone: {selectedMember.phone}</p>
                {selectedMember.email && <p className="text-xs text-dark-500 font-medium">Email: {selectedMember.email}</p>}
              </div>
            </div>

            {/* Grid of Profile Attributes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              <div className="rounded-lg border border-dark-100 dark:border-white/10 bg-dark-50/20 dark:bg-white/[0.01] p-3">
                <p className="text-[10px] uppercase tracking-widest text-dark-500 mb-1">Ward Details</p>
                <div className="text-sm font-semibold text-dark-900 dark:text-dark-100">
                  {selectedMember.ward_name ? `Ward: ${selectedMember.ward_name}` : `Ward Number: ${selectedMember.ward_number || '—'}`}
                </div>
              </div>

              <div className="rounded-lg border border-dark-100 dark:border-white/10 bg-dark-50/20 dark:bg-white/[0.01] p-3">
                <p className="text-[10px] uppercase tracking-widest text-dark-500 mb-1">Booth Details</p>
                <div className="text-sm font-semibold text-dark-900 dark:text-dark-100">
                  {selectedMember.booth_name ? `Booth: ${selectedMember.booth_name}` : selectedMember.booth_number ? `Booth Number: ${selectedMember.booth_number}` : '—'}
                </div>
              </div>

              <div className="rounded-lg border border-dark-100 dark:border-white/10 bg-dark-50/20 dark:bg-white/[0.01] p-3">
                <p className="text-[10px] uppercase tracking-widest text-dark-500 mb-1">Qualification</p>
                <div className="text-sm font-semibold text-dark-900 dark:text-dark-100">
                  {selectedMember.qualification || '—'}
                </div>
              </div>

              <div className="rounded-lg border border-dark-100 dark:border-white/10 bg-dark-50/20 dark:bg-white/[0.01] p-3">
                <p className="text-[10px] uppercase tracking-widest text-dark-500 mb-1">Profession</p>
                <div className="text-sm font-semibold text-dark-900 dark:text-dark-100">
                  {selectedMember.profession || '—'}
                </div>
              </div>

              <div className="rounded-lg border border-dark-100 dark:border-white/10 bg-dark-50/20 dark:bg-white/[0.01] p-3">
                <p className="text-[10px] uppercase tracking-widest text-dark-500 mb-1">Gender / Age</p>
                <div className="text-sm font-semibold text-dark-900 dark:text-dark-100 capitalize">
                  {selectedMember.gender || '—'} {selectedMember.age ? `(${selectedMember.age} years old)` : ''}
                </div>
              </div>

              <div className="rounded-lg border border-dark-100 dark:border-white/10 bg-dark-50/20 dark:bg-white/[0.01] p-3">
                <p className="text-[10px] uppercase tracking-widest text-dark-500 mb-1">Address</p>
                <div className="text-sm font-semibold text-dark-900 dark:text-dark-100">
                  {selectedMember.address || '—'}
                </div>
              </div>

              <div className="rounded-lg border border-dark-100 dark:border-white/10 bg-dark-50/20 dark:bg-white/[0.01] p-3">
                <p className="text-[10px] uppercase tracking-widest text-dark-500 mb-1">Registered By</p>
                <div className="text-sm font-semibold text-dark-900 dark:text-dark-100">
                  {selectedMember.created_by_name} ({formatRole(selectedMember.created_by_role)})
                </div>
              </div>

              <div className="rounded-lg border border-dark-100 dark:border-white/10 bg-dark-50/20 dark:bg-white/[0.01] p-3">
                <p className="text-[10px] uppercase tracking-widest text-dark-500 mb-1">Registered Date</p>
                <div className="text-sm font-semibold text-dark-900 dark:text-dark-100">
                  {selectedMember.created_at ? new Date(selectedMember.created_at).toLocaleString() : '—'}
                </div>
              </div>

            </div>
          </div>
        )}
      </Modal>

      {/* Detailed Performer Modal */}
      <Modal
        isOpen={!!selectedCreatorId}
        onClose={() => { setSelectedCreatorId(null); setCreatorDetails(null); }}
        title="Performer Activity Summary"
        subtitle="Granular activity tracking, geographical breakdowns, and sentiment distributions"
        maxWidth="max-w-[850px]"
        footer={(
          <button type="button" onClick={() => { setSelectedCreatorId(null); setCreatorDetails(null); }} className="btn-secondary min-w-[120px]">
            Close
          </button>
        )}
      >
        {creatorLoading || !creatorDetails ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-saffron-500" />
            <span className="text-xs font-medium text-dark-500 uppercase tracking-widest">Fetching performer analytics...</span>
          </div>
        ) : (
          <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-2 custom-scrollbar">
            
            {/* Performer Profile Card */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-5 rounded-2xl bg-dark-50 dark:bg-white/[0.01] border border-dark-200/50 dark:border-white/5">
              {creatorDetails.profile.avatar_url ? (
                <img src={creatorDetails.profile.avatar_url} alt={creatorDetails.profile.name} className="w-16 h-16 rounded-2xl object-cover border border-dark-200 dark:border-white/10" />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold uppercase shadow-lg shrink-0">
                  {creatorDetails.profile.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-dark-900 dark:text-white leading-tight">{creatorDetails.profile.name}</h3>
                <p className="text-xs font-semibold text-saffron-500 uppercase tracking-wider mt-0.5">{creatorDetails.profile.role_name?.replace(/_/g, ' ')}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-dark-500 font-medium">
                  <div>Email: <span className="font-semibold text-dark-700 dark:text-dark-300">{creatorDetails.profile.email || '—'}</span></div>
                  <div>Phone: <span className="font-semibold text-dark-700 dark:text-dark-300">{creatorDetails.profile.phone || '—'}</span></div>
                  {creatorDetails.profile.ward_name && <div>Ward: <span className="font-semibold text-dark-700 dark:text-dark-300">{creatorDetails.profile.ward_name}</span></div>}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-saffron-500/10 border border-saffron-500/20 text-center sm:self-center shrink-0 self-start min-w-[100px]">
                <div className="text-2xl font-extrabold text-saffron-600 dark:text-saffron-400">{creatorDetails.stats.total_members}</div>
                <div className="text-[9px] font-black text-dark-500 uppercase tracking-widest mt-1">Added</div>
              </div>
            </div>

            {/* Grid for breakdowns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Support Distribution Pie */}
              <div className="glass-card p-5 border border-dark-100/50 dark:border-white/5">
                <h4 className="text-sm font-bold text-dark-900 dark:text-white mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-saffron-500" /> Sentiment Preference
                </h4>
                {creatorDetails.stats.support_distribution.length === 0 ? (
                  <EmptyState message="No sentiment data available" />
                ) : (
                  <div className="h-[200px]">
                    <Pie
                      options={pieOptions}
                      data={{
                        labels: creatorDetails.stats.support_distribution.map((d: any) => d.support_preference),
                        datasets: [{
                          data: creatorDetails.stats.support_distribution.map((d: any) => d.count),
                          backgroundColor: creatorDetails.stats.support_distribution.map((d: any) => {
                            switch (d.support_preference?.toLowerCase()) {
                              case 'bjp': return '#f97316';
                              case 'samajwadi party': return '#10b981';
                              case 'congress': return '#3b82f6';
                              case 'bsp': return '#6366f1';
                              case 'aap': return '#eab308';
                              case 'neutral': return '#64748b';
                              case 'undecided': return '#a855f7';
                              default: return '#14b8a6';
                            }
                          }),
                          borderWidth: 0
                        }]
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Monthly growth line chart */}
              <div className="glass-card p-5 border border-dark-100/50 dark:border-white/5">
                <h4 className="text-sm font-bold text-dark-900 dark:text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-saffron-500" /> Registration Timeline
                </h4>
                {creatorDetails.stats.timeline.length === 0 ? (
                  <EmptyState message="No timeline data available" />
                ) : (
                  <div className="h-[200px]">
                    <Line
                      options={chartDefaults}
                      data={{
                        labels: creatorDetails.stats.timeline.map((d: any) => {
                          try {
                            return format(new Date(d.month), 'MMM yyyy');
                          } catch {
                            return String(d.month).slice(0, 7);
                          }
                        }),
                        datasets: [{
                          label: 'Members',
                          data: creatorDetails.stats.timeline.map((d: any) => d.count),
                          borderColor: '#f97316',
                          backgroundColor: 'rgba(249, 115, 22, 0.12)',
                          fill: true,
                          tension: 0.35,
                          pointRadius: 3,
                          pointBackgroundColor: '#f97316',
                          pointBorderColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                          pointBorderWidth: 1.5,
                          borderWidth: 2
                        }]
                      }}
                    />
                  </div>
                )}
              </div>

            </div>

            {/* Geographical Breakdowns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Ward breakdown */}
              <div className="glass-card p-5 border border-dark-100/50 dark:border-white/5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-dark-500 mb-3">Ward Distribution</h4>
                <div className="max-h-[220px] overflow-y-auto divide-y divide-dark-100 dark:divide-white/5 pr-1 custom-scrollbar">
                  {creatorDetails.stats.ward_breakdown.length === 0 ? (
                    <div className="text-center py-8 text-xs text-dark-500">No ward registrations.</div>
                  ) : (
                    creatorDetails.stats.ward_breakdown.map((item: any) => (
                      <div key={item.ward_name} className="flex justify-between items-center py-2.5">
                        <span className="text-xs font-semibold text-dark-800 dark:text-dark-300">{item.ward_name}</span>
                        <span className="text-xs font-bold text-saffron-500">{item.count} members</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Booth breakdown */}
              <div className="glass-card p-5 border border-dark-100/50 dark:border-white/5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-dark-500 mb-3">Booth Distribution (Top 10)</h4>
                <div className="max-h-[220px] overflow-y-auto divide-y divide-dark-100 dark:divide-white/5 pr-1 custom-scrollbar">
                  {creatorDetails.stats.booth_breakdown.length === 0 ? (
                    <div className="text-center py-8 text-xs text-dark-500">No booth registrations.</div>
                  ) : (
                    creatorDetails.stats.booth_breakdown.map((item: any) => (
                      <div key={item.booth_name} className="flex justify-between items-center py-2.5">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-dark-800 dark:text-dark-300 truncate">{item.booth_name}</div>
                          <div className="text-[10px] text-dark-500">Booth No: {item.booth_number || '—'}</div>
                        </div>
                        <span className="text-xs font-bold text-indigo-500">{item.count} members</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

            {/* Recent Registrations List */}
            <div className="glass-card p-5 border border-dark-100/50 dark:border-white/5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-dark-500 mb-3">Recent Registrations (Last 10)</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs text-dark-800 dark:text-dark-300">
                  <thead>
                    <tr className="border-b border-dark-100 dark:border-white/5 text-dark-500 font-bold uppercase tracking-wider">
                      <th className="py-2">Supporter</th>
                      <th className="py-2">Phone</th>
                      <th className="py-2">Geography</th>
                      <th className="py-2">Preference</th>
                      <th className="py-2 text-right">Date Added</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-100 dark:divide-white/5">
                    {creatorDetails.stats.recent_registrations.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-dark-500">No registrations found.</td>
                      </tr>
                    ) : (
                      creatorDetails.stats.recent_registrations.map((member: any) => (
                        <tr key={member.id} className="hover:bg-dark-50/50 dark:hover:bg-white/[0.01]">
                          <td className="py-3 font-bold text-dark-900 dark:text-white">{member.full_name}</td>
                          <td className="py-3 font-semibold">{member.phone}</td>
                          <td className="py-3">
                            <div>{member.ward_name}</div>
                            <div className="text-[10px] text-dark-500">{member.booth_name || '—'}</div>
                          </td>
                          <td className="py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${getSupportBadgeStyle(member.support_preference)}`}>
                              {member.support_preference}
                            </span>
                          </td>
                          <td className="py-3 text-right text-dark-500">
                            {member.created_at ? format(new Date(member.created_at), 'dd MMM yyyy') : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </Modal>
    </>
  );
}

export default function PartyMembersPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-saffron-500" />
      </div>
    }>
      <PartyMembersContent />
    </Suspense>
  );
}
