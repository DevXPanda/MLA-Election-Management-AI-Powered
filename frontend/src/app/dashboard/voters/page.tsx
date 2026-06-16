'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { toast } from 'react-hot-toast';
import { showToast } from '@/lib/toast';
import Header from '@/components/Header';
import { votersAPI, constituencyAPI } from '@/lib/api';
import { Voter } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { 
  Plus, Search, Edit3, Trash2, X, Loader2, UserPlus, 
  ChevronLeft, ChevronRight as ChevronRightIcon,
  Users, Heart, Users2, ShieldAlert, Eye
} from 'lucide-react';
import Modal from '@/components/Modal';
import { useSearchParams } from 'next/navigation';
import StatsSummary from '@/components/dashboard/StatsSummary';
import DetailsModal from '@/components/DetailsModal';
import { MODULE_HEADER, SHARED_UI } from '@/lib/ui-labels';
import { useLanguage } from '@/context/LanguageContext';

function VotersContent() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [voters, setVoters] = useState<Voter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingVoter, setEditingVoter] = useState<Voter | null>(null);
  const [selectedVoter, setSelectedVoter] = useState<Voter | null>(null);
  const [search, setSearch] = useState('');
  const [supportFilter, setSupportFilter] = useState('');
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [votersStats, setVotersStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [constituencyList, setConstituencyList] = useState<any[]>([]);
  const [wardList, setWardList] = useState<any[]>([]);
  const [boothList, setBoothList] = useState<any[]>([]);
  const [loadingWards, setLoadingWards] = useState(false);
  const [loadingBooths, setLoadingBooths] = useState(false);

  const [form, setForm] = useState({
    voter_id_number: '', name: '', phone: '', address: '', age: '',
    gender: '', caste: '', scheme_beneficiary: false, support_status: 'unknown', remarks: '',
    constituency_id: '', ward_id: '', booth_id: '',
  });

  const effectiveConstituencyId = user?.constituency_id || form.constituency_id;

  console.log('VotersPage Debug:', {
    userConstituencyId: user?.constituency_id,
    formConstituencyId: form.constituency_id,
    effectiveConstituencyId,
    wardListLength: wardList.length,
    boothListLength: boothList.length
  });

  useEffect(() => {
    console.log('Fetching constituencies check... user:', user);
    if (user && !user.constituency_id) {
      constituencyAPI.getConstituencies()
        .then(res => {
          console.log('Fetched constituencies:', res.data.data);
          setConstituencyList(res.data.data || []);
        })
        .catch(err => console.error('Error fetching constituencies:', err));
    }
  }, [user]);

  useEffect(() => {
    console.log('Fetching Wards check... effectiveConstituencyId:', effectiveConstituencyId, 'showModal:', showModal);
    if (showModal && effectiveConstituencyId) {
      setLoadingWards(true);
      constituencyAPI.getWards(parseInt(String(effectiveConstituencyId)))
        .then(res => {
          console.log('Fetched Wards:', res.data.data);
          setWardList(res.data.data || []);
        })
        .catch(err => console.error('Error fetching Wards:', err))
        .finally(() => setLoadingWards(false));
    } else if (!showModal) {
      console.log('Clearing Wards list because modal is closed');
      setWardList([]);
    }
  }, [effectiveConstituencyId, showModal]);

  useEffect(() => {
    console.log('Fetching Booths check... form.ward_id:', form.ward_id, 'showModal:', showModal);
    if (showModal && form.ward_id) {
      setLoadingBooths(true);
      constituencyAPI.getBooths(parseInt(String(form.ward_id)))
        .then(res => {
          console.log('Fetched Booths:', res.data.data);
          setBoothList(res.data.data || []);
        })
        .catch(err => console.error('Error fetching Booths:', err))
        .finally(() => setLoadingBooths(false));
    } else if (!showModal || !form.ward_id) {
      console.log('Clearing Booths list because modal is closed or ward is empty');
      setBoothList([]);
    }
  }, [form.ward_id, showModal]);

  const searchParams = useSearchParams();
  const boothId = searchParams.get('booth_id');
  const wardId = searchParams.get('ward_id');

  const loadVoters = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 15 };
      if (search) params.search = search;
      if (supportFilter) params.support_status = supportFilter;
      if (boothId) params.booth_id = boothId;
      if (wardId) params.ward_id = wardId;
      
      const res = await votersAPI.getAll(params);
      setVoters(res.data.data);
      setMeta(res.data.meta);
    } catch (err) { 
      console.error(err); 
    } finally { 
      setLoading(false); 
    }
  }, [search, supportFilter, boothId, wardId]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await votersAPI.getStats();
      setVotersStats(res.data.data);
    } catch { }
    finally { setStatsLoading(false); }
  }, []);

  useEffect(() => { 
    loadVoters(meta.page); 
  }, [loadVoters, meta.page]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const openCreate = () => {
    setEditingVoter(null);
    setForm({ 
      voter_id_number: '', name: '', phone: '', address: '', age: '', gender: '', caste: '', 
      scheme_beneficiary: false, support_status: 'unknown', remarks: '',
      constituency_id: user?.constituency_id ? String(user.constituency_id) : '',
      ward_id: '',
      booth_id: '',
    });
    setWardList([]);
    setBoothList([]);
    setShowModal(true);
  };

  const openEdit = (voter: Voter) => {
    setEditingVoter(voter);
    setForm({
      voter_id_number: voter.voter_id_number || '', name: voter.name, phone: voter.phone || '',
      address: voter.address || '', age: voter.age ? String(voter.age) : '', gender: voter.gender || '',
      caste: voter.caste || '', scheme_beneficiary: voter.scheme_beneficiary, support_status: voter.support_status,
      remarks: voter.remarks || '',
      constituency_id: voter.constituency_id ? String(voter.constituency_id) : '',
      ward_id: voter.ward_id ? String(voter.ward_id) : '',
      booth_id: voter.booth_id ? String(voter.booth_id) : '',
    });
    setWardList([]);
    setBoothList([]);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const constId = user?.constituency_id || form.constituency_id;
      if (!constId) {
        toast.error(t('voters.constituency_required', 'Constituency assignment is mandatory.'));
        return;
      }
      if (!form.ward_id) {
        toast.error(t('voters.ward_required', 'Ward assignment is mandatory.'));
        return;
      }
      if (!form.booth_id) {
        toast.error(t('voters.booth_required', 'Booth assignment is mandatory.'));
        return;
      }

      const data = { 
        ...form, 
        age: form.age ? parseInt(form.age) : null,
        constituency_id: parseInt(String(constId)),
        ward_id: parseInt(form.ward_id),
        booth_id: parseInt(form.booth_id),
      };
      if (editingVoter) { await votersAPI.update(editingVoter.id, data); }
      else { await votersAPI.create(data); }
      setShowModal(false);
      loadVoters(meta.page);
    } catch (err: any) { 
      showToast.error(err.response?.data?.message || 'Error saving voter'); 
    }
  };

  const handleDelete = async (id: number) => {
    showToast.confirm(
      t('voters.delete_voter_title', 'Delete Voter'),
      t('voters.delete_voter_confirm', 'Are you sure you want to remove this voter record? This action cannot be reversed.'),
      async () => {
        try { 
          await votersAPI.delete(id); 
          loadVoters(meta.page); 
          toast.success(t('voters.deleted_success', 'Voter record deleted'));
        } catch (err) {
          showToast.error(t('voters.delete_failed', 'Failed to delete voter'));
        }
      },
      t('action.delete', 'Delete')
    );
  };

  const supportBadge = (status: string) => {
    switch(status) {
      case 'supporter': return 'badge-success';
      case 'neutral': return 'badge-warning';
      case 'opponent': return 'badge-danger';
      default: return 'badge-neutral';
    }
  };

  const supportDot = (status: string) => {
    switch(status) {
      case 'supporter': return 'bg-green-400';
      case 'neutral': return 'bg-amber-400';
      case 'opponent': return 'bg-red-400';
      default: return 'bg-dark-500';
    }
  };

  return (
    <>
      <Header title={MODULE_HEADER.voters.title} subtitle={MODULE_HEADER.voters.subtitle} />
      <div className="dashboard-container">
        {/* Summary Stats Row */}
        <StatsSummary 
          loading={statsLoading}
          stats={[
            { label: t('dashboard.total_voters', 'Total Voters'), value: votersStats?.total || 0, icon: Users, color: 'text-blue-500', bgIcon: 'bg-blue-500/10' },
            { label: t('support.supporter', 'Supporters'), value: votersStats?.support_breakdown?.find((s: any) => s.support_status === 'supporter')?.count || 0, icon: Heart, color: 'text-emerald-500', bgIcon: 'bg-emerald-500/10' },
            { label: t('support.neutral', 'Neutrals'), value: votersStats?.support_breakdown?.find((s: any) => s.support_status === 'neutral')?.count || 0, icon: Users2, color: 'text-amber-500', bgIcon: 'bg-amber-500/10' },
            { label: t('support.opponent', 'Opponents'), value: votersStats?.support_breakdown?.find((s: any) => s.support_status === 'opponent')?.count || 0, icon: ShieldAlert, color: 'text-red-500', bgIcon: 'bg-red-500/10' },
          ]}
        />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-xl font-medium">{t('voters.records_title', 'Constituency Records')}</h2>
          <button onClick={openCreate} className="btn-primary"><UserPlus className="w-4 h-4" /> {t('voters.add_voter', 'Add Voter')}</button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('voters.search_placeholder', 'Search voters...')} className="form-input pl-10" />
          </div>
          {['', 'supporter', 'neutral', 'opponent', 'unknown'].map(s => (
            <button key={s} onClick={() => { setSupportFilter(s); setMeta(prev => ({ ...prev, page: 1 })); }}
              className={`filter-tab ${supportFilter === s ? 'active' : ''}`}>
              {s && <span className={`w-2 h-2 rounded-full ${supportDot(s)}`} />}
              <span className="capitalize">{s ? t('support.' + s, s) : t('label.all', 'All')}</span>
            </button>
          ))}
        </div>

        {/* Table container with horizontal scroll for responsiveness */}
        <div className="glass-card table-responsive">
          <table className="data-table">
            <thead>
                <tr>
                  <th className="w-[30%] min-w-[200px]">{t('voters.table_voter', 'Voter')}</th>
                  <th className="min-w-[120px]">{t('voters.table_phone', 'Phone')}</th>
                  <th className="min-w-[150px]">{t('voters.table_booth_ward', 'Booth / Ward')}</th>
                  <th className="min-w-[100px]">{t('voters.table_gender', 'Gender')}</th>
                  <th className="min-w-[100px]">{t('voters.table_caste', 'Caste')}</th>
                  <th className="min-w-[120px]">{t('voters.table_support', 'Support')}</th>
                  <th className="min-w-[100px]">{t('voters.table_beneficiary', 'Beneficiary')}</th>
                  <th className="text-right whitespace-nowrap">{t('voters.table_actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-100 dark:divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-24">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-saffron-500" />
                        <span className="text-xs font-medium text-dark-500 uppercase tracking-widest">{t('voters.accessing_base', 'Accessing Voter Base...')}</span>
                      </div>
                    </td>
                  </tr>
                ) : voters.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-dark-500">{t('voters.no_voters_found', 'No voters found')}</td></tr>
                ) : (
                  voters.map(voter => (
                    <tr key={voter.id} className="hover:bg-dark-50/50 dark:hover:bg-white/[0.02] transition-colors">
                      <td>
                        <div className="flex flex-col gap-0.5">
                          <div className="font-medium text-dark-900 dark:text-dark-100 truncate">{voter.name}</div>
                          {voter.voter_id_number && <div className="text-[10px] font-medium uppercase tracking-widest text-dark-500">{t('voters.id_number', 'ID')}: {voter.voter_id_number}</div>}
                        </div>
                      </td>
                      <td className="text-dark-600 dark:text-dark-400 font-medium">{voter.phone || '—'}</td>
                      <td>
                        <div className="text-sm font-medium text-dark-900 dark:text-dark-300 truncate">{voter.booth_name || '—'}</div>
                        <div className="text-[11px] font-normal text-dark-500 truncate">{voter.ward_name || ''}</div>
                      </td>
                      <td className="text-dark-500 dark:text-dark-400 capitalize">{voter.gender ? t('gender.' + voter.gender, voter.gender) : '—'}</td>
                      <td className="text-dark-500 dark:text-dark-400">{voter.caste || '—'}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${supportDot(voter.support_status)}`} />
                          <span className="text-xs font-medium capitalize text-dark-800 dark:text-dark-300">{t('support.' + voter.support_status, voter.support_status)}</span>
                        </div>
                      </td>
                      <td>
                        {voter.scheme_beneficiary ? 
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-medium border border-emerald-500/12">{t('label.yes', 'Yes')}</span> : 
                          <span className="text-dark-400 text-xs">{t('label.no', 'No')}</span>
                        }
                      </td>
                      <td>
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setSelectedVoter(voter)} className="p-2 rounded-lg bg-dark-100 dark:bg-dark-800 text-dark-600 dark:text-dark-400 hover:bg-saffron-500/10 hover:text-saffron-500 transition-all" title={t('action.view', 'View')}><Eye className="w-3.5 h-3.5" /></button>
                          <button onClick={() => openEdit(voter)} className="p-2 rounded-lg bg-dark-100 dark:bg-dark-800 text-dark-600 dark:text-dark-400 hover:bg-saffron-500/10 hover:text-saffron-500 transition-all"><Edit3 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDelete(voter.id)} className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
          </table>
        </div>
          
          {/* Pagination */}
          {!loading && meta.totalPages > 1 && (
            <div className="px-6 py-4 flex items-center justify-between border-t border-dark-100 dark:border-white/5 bg-dark-50/30 dark:bg-white/[0.01]">
              <p className="text-xs text-dark-500 font-medium">
                {t('voters.page_info', 'Page {page} of {totalPages} • Total {total} records').replace('{page}', String(meta.page)).replace('{totalPages}', String(meta.totalPages)).replace('{total}', String(meta.total))}
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
        </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingVoter ? t('voters.edit_voter', 'Edit Voter') : t('voters.add_new_voter', 'Add New Voter')}
        subtitle={t('voters.modal_subtitle', 'Update voter information and support status')}
        maxWidth="max-w-[800px]"
        footer={(
          <div className="flex gap-3 justify-end w-full">
            <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2.5 rounded-xl border border-dark-200 dark:border-white/10 text-dark-500 font-medium hover:bg-dark-50 transition-all">{t('action.cancel', 'Cancel')}</button>
            <button type="submit" form="voter-form" className="px-8 py-2.5 rounded-xl bg-saffron-500 text-dark-950 font-medium shadow-lg shadow-saffron-500/20 hover:scale-105 active:scale-95 transition-all">
              {editingVoter ? t('action.save', 'Save Changes') : t('voters.register_voter', 'Register Voter')}
            </button>
          </div>
        )}
      >
        <form id="voter-form" onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-medium text-dark-400 uppercase tracking-widest px-1">{t('voters.full_name', 'Full Name *')}</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="form-input" placeholder="e.g. Rahul Kumar" required />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-medium text-dark-400 uppercase tracking-widest px-1">{t('voters.id_number', 'Voter ID Number')}</label>
              <input value={form.voter_id_number} onChange={e => setForm({...form, voter_id_number: e.target.value})} className="form-input" placeholder="XYZ1234567" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-medium text-dark-400 uppercase tracking-widest px-1">{t('label.phone', 'Phone')}</label>
              <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="form-input" placeholder="+91 0000000000" />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-medium text-dark-400 uppercase tracking-widest px-1">{t('label.age', 'Age')}</label>
              <input type="number" value={form.age} onChange={e => setForm({...form, age: e.target.value})} className="form-input" placeholder="18" />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-medium text-dark-400 uppercase tracking-widest px-1">{t('label.gender', 'Gender')}</label>
              <select value={form.gender} onChange={e => setForm({...form, gender: e.target.value})} className="form-input">
                <option value="">{t('voters.select_gender', 'Select Gender')}</option>
                <option value="male">{t('gender.male', 'Male')}</option>
                <option value="female">{t('gender.female', 'Female')}</option>
                <option value="other">{t('gender.other', 'Other')}</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-medium text-dark-400 uppercase tracking-widest px-1">{t('voters.full_address', 'Full Address')}</label>
            <input value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="form-input" placeholder="House No, Street, Landmark, Area..." />
          </div>

          {/* Geographical Hierarchy Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {!user?.constituency_id && (
              <div className="space-y-2 col-span-2">
                <label className="block text-[10px] font-medium text-dark-400 uppercase tracking-widest px-1">
                  {t('label.constituency', 'Constituency')} *
                </label>
                <select
                  value={form.constituency_id}
                  onChange={e => {
                    setForm({ ...form, constituency_id: e.target.value, ward_id: '', booth_id: '' });
                    setWardList([]);
                    setBoothList([]);
                  }}
                  className="form-input"
                  required
                >
                  <option value="">{t('label.select', 'Select') + ' ' + t('label.constituency', 'Constituency')}</option>
                  {constituencyList.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-[10px] font-medium text-dark-400 uppercase tracking-widest px-1">
                {t('label.ward', 'Ward')} *
              </label>
              <select
                value={form.ward_id}
                onChange={e => setForm({ ...form, ward_id: e.target.value, booth_id: '' })}
                className="form-input"
                disabled={loadingWards || (!user?.constituency_id && !form.constituency_id)}
                required
              >
                <option value="">
                  {loadingWards ? t('action.loading', 'Loading...') : (t('label.select', 'Select') + ' ' + t('label.ward', 'Ward'))}
                </option>
                {wardList.map(w => (
                  <option key={w.id} value={w.id}>{t('label.ward', 'Ward')} {w.number} - {w.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-medium text-dark-400 uppercase tracking-widest px-1">
                {t('label.booth', 'Booth')} *
              </label>
              <select
                value={form.booth_id}
                onChange={e => setForm({ ...form, booth_id: e.target.value })}
                className="form-input"
                disabled={loadingBooths || !form.ward_id}
                required
              >
                <option value="">
                  {loadingBooths ? t('action.loading', 'Loading...') : (t('label.select', 'Select') + ' ' + t('label.booth', 'Booth'))}
                </option>
                {boothList.map(b => (
                  <option key={b.id} value={b.id}>{t('label.booth', 'Booth')} {b.number} - {b.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-medium text-dark-400 uppercase tracking-widest px-1">{t('label.caste', 'Caste / Community')}</label>
              <input value={form.caste} onChange={e => setForm({...form, caste: e.target.value})} className="form-input" placeholder="e.g. General" />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-medium text-dark-400 uppercase tracking-widest px-1">{t('label.support', 'Support Status')}</label>
              <select value={form.support_status} onChange={e => setForm({...form, support_status: e.target.value})} className="form-input">
                <option value="unknown">{t('label.unknown', 'Unknown')}</option>
                <option value="supporter">{t('support.supporter', 'Supporter')}</option>
                <option value="neutral">{t('support.neutral', 'Neutral')}</option>
                <option value="opponent">{t('support.opponent', 'Opponent')}</option>
              </select>
            </div>
            <div className="flex items-end pb-3">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input type="checkbox" checked={form.scheme_beneficiary}
                    onChange={e => setForm({...form, scheme_beneficiary: e.target.checked})}
                    className="sr-only peer"
                  />
                  <div className="w-5 h-5 border-2 border-dark-200 dark:border-white/10 rounded-md peer-checked:bg-saffron-500 peer-checked:border-saffron-500 transition-all"></div>
                  <div className="absolute inset-0 flex items-center justify-center text-white scale-0 peer-checked:scale-100 transition-transform">
                    <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20"><path d="M0 11l2-2 5 5L18 3l2 2L7 18z"/></svg>
                  </div>
                </div>
                <span className="text-sm font-medium text-dark-600 dark:text-dark-400 group-hover:text-dark-200 transition-colors">{t('voters.scheme_beneficiary', 'Scheme Beneficiary')}</span>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-medium text-dark-400 uppercase tracking-widest px-1">{SHARED_UI.voterRemarks}</label>
            <textarea value={form.remarks} onChange={e => setForm({...form, remarks: e.target.value})} className="form-input h-24 resize-none" placeholder={t('voters.remarks_placeholder', 'Add observations...')} />
          </div>
        </form>
      </Modal>

      <DetailsModal
        isOpen={!!selectedVoter}
        onClose={() => setSelectedVoter(null)}
        title={t('voters.details_title', 'Voter Details')}
        subtitle={t('voters.details_subtitle', 'Complete constituency and sentiment profile')}
        items={[
          { label: t('label.name', 'Name'), value: selectedVoter?.name },
          { label: t('label.role', 'Role'), value: t('sidebar.voters', 'Voter') },
          { label: t('label.caste', 'Caste'), value: selectedVoter?.caste || '—' },
          { label: t('voters.assigned_leader', 'Assigned Leader'), value: selectedVoter?.created_by_name || '—' },
          { label: t('label.ward', 'Ward'), value: selectedVoter?.ward_name || '—' },
          { label: t('label.booth', 'Booth'), value: selectedVoter?.booth_name || '—' },
          { label: t('label.constituency', 'Constituency'), value: selectedVoter?.constituency_name || '—' },
          { label: t('voters.id_number', 'Voter ID'), value: selectedVoter?.voter_id_number || '—' },
          { label: t('label.phone', 'Phone'), value: selectedVoter?.phone || '—' },
          { label: t('label.age', 'Age'), value: selectedVoter?.age || '—' },
          { label: t('label.gender', 'Gender'), value: selectedVoter?.gender ? t('gender.' + selectedVoter.gender, selectedVoter.gender) : '—' },
          { label: t('label.address', 'Address'), value: selectedVoter?.address || '—' },
          { label: t('label.support', 'Support Status'), value: selectedVoter?.support_status ? t('support.' + selectedVoter.support_status, selectedVoter.support_status) : '—' },
          { label: t('voters.scheme_beneficiary', 'Scheme Beneficiary'), value: selectedVoter?.scheme_beneficiary ? t('label.yes', 'Yes') : t('label.no', 'No') },
          { label: t('label.remarks', 'Remarks'), value: selectedVoter?.remarks || '—' },
          { label: t('label.date', 'Created At'), value: selectedVoter?.created_at ? new Date(selectedVoter.created_at).toLocaleString() : '—' },
        ]}
      />
    </>
  );
}

export default function VotersPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-saffron-500" />
      </div>
    }>
      <VotersContent />
    </Suspense>
  );
}
