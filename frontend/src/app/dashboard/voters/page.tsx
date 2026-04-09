'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { toast } from 'react-hot-toast';
import { showToast } from '@/lib/toast';
import Header from '@/components/Header';
import { votersAPI } from '@/lib/api';
import { Voter } from '@/types';
import { 
  Plus, Search, Edit3, Trash2, X, Loader2, UserPlus, 
  ChevronLeft, ChevronRight as ChevronRightIcon,
  Users, Heart, Users2, ShieldAlert
} from 'lucide-react';
import Modal from '@/components/Modal';
import { useSearchParams } from 'next/navigation';
import StatsSummary from '@/components/dashboard/StatsSummary';

function VotersContent() {
  const [voters, setVoters] = useState<Voter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingVoter, setEditingVoter] = useState<Voter | null>(null);
  const [search, setSearch] = useState('');
  const [supportFilter, setSupportFilter] = useState('');
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [votersStats, setVotersStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [form, setForm] = useState({
    voter_id_number: '', name: '', phone: '', address: '', age: '',
    gender: '', caste: '', scheme_beneficiary: false, support_status: 'unknown', remarks: '',
  });

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
    setForm({ voter_id_number: '', name: '', phone: '', address: '', age: '', gender: '', caste: '', scheme_beneficiary: false, support_status: 'unknown', remarks: '' });
    setShowModal(true);
  };

  const openEdit = (voter: Voter) => {
    setEditingVoter(voter);
    setForm({
      voter_id_number: voter.voter_id_number || '', name: voter.name, phone: voter.phone || '',
      address: voter.address || '', age: voter.age ? String(voter.age) : '', gender: voter.gender || '',
      caste: voter.caste || '', scheme_beneficiary: voter.scheme_beneficiary, support_status: voter.support_status,
      remarks: voter.remarks || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = { ...form, age: form.age ? parseInt(form.age) : null };
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
      'Delete Voter',
      'Are you sure you want to remove this voter record? This action cannot be reversed.',
      async () => {
        try { 
          await votersAPI.delete(id); 
          loadVoters(meta.page); 
          toast.success('Voter record deleted');
        } catch (err) {
          showToast.error('Failed to delete voter');
        }
      },
      'Delete'
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
      <Header title="Voter Management" subtitle="Voter database and support tracking" />
      <div className="dashboard-container">
        {/* Summary Stats Row */}
        <StatsSummary 
          loading={statsLoading}
          stats={[
            { label: 'Total Voters', value: votersStats?.total || 0, icon: Users, color: 'text-blue-500', bgIcon: 'bg-blue-500/10' },
            { label: 'Supporters', value: votersStats?.support_breakdown?.find((s: any) => s.support_status === 'supporter')?.count || 0, icon: Heart, color: 'text-emerald-500', bgIcon: 'bg-emerald-500/10' },
            { label: 'Neutrals', value: votersStats?.support_breakdown?.find((s: any) => s.support_status === 'neutral')?.count || 0, icon: Users2, color: 'text-amber-500', bgIcon: 'bg-amber-500/10' },
            { label: 'Opponents', value: votersStats?.support_breakdown?.find((s: any) => s.support_status === 'opponent')?.count || 0, icon: ShieldAlert, color: 'text-red-500', bgIcon: 'bg-red-500/10' },
          ]}
        />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-xl font-medium">Constituency Records</h2>
          <button onClick={openCreate} className="btn-primary"><UserPlus className="w-4 h-4" /> Add Voter</button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search voters..." className="form-input pl-10" />
          </div>
          {['', 'supporter', 'neutral', 'opponent', 'unknown'].map(s => (
            <button key={s} onClick={() => { setSupportFilter(s); setMeta(prev => ({ ...prev, page: 1 })); }}
              className={`filter-tab ${supportFilter === s ? 'active' : ''}`}>
              {s && <span className={`w-2 h-2 rounded-full ${supportDot(s)}`} />}
              <span className="capitalize">{s ? s : 'All'}</span>
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto overflow-y-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-[30%] min-w-[200px]">Voter</th>
                  <th className="min-w-[120px]">Phone</th>
                  <th className="min-w-[150px]">Booth / Ward</th>
                  <th className="min-w-[100px]">Gender</th>
                  <th className="min-w-[100px]">Caste</th>
                  <th className="min-w-[120px]">Support</th>
                  <th className="min-w-[100px]">Beneficiary</th>
                  <th className="text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-100 dark:divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-24">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-saffron-500" />
                        <span className="text-xs font-medium text-dark-500 uppercase tracking-widest">Accessing Voter Base...</span>
                      </div>
                    </td>
                  </tr>
                ) : voters.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-dark-500">No voters found</td></tr>
                ) : (
                  voters.map(voter => (
                    <tr key={voter.id} className="hover:bg-dark-50/50 dark:hover:bg-white/[0.02] transition-colors">
                      <td>
                        <div className="flex flex-col gap-0.5">
                          <div className="font-medium text-dark-900 dark:text-dark-100 truncate">{voter.name}</div>
                          {voter.voter_id_number && <div className="text-[10px] font-medium uppercase tracking-widest text-dark-500">ID: {voter.voter_id_number}</div>}
                        </div>
                      </td>
                      <td className="text-dark-600 dark:text-dark-400 font-medium">{voter.phone || '—'}</td>
                      <td>
                        <div className="text-sm font-medium text-dark-900 dark:text-dark-300 truncate">{voter.booth_name || '—'}</div>
                        <div className="text-[11px] font-normal text-dark-500 truncate">{voter.ward_name || ''}</div>
                      </td>
                      <td className="text-dark-500 dark:text-dark-400 capitalize">{voter.gender || '—'}</td>
                      <td className="text-dark-500 dark:text-dark-400">{voter.caste || '—'}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${supportDot(voter.support_status)}`} />
                          <span className="text-xs font-medium capitalize text-dark-800 dark:text-dark-300">{voter.support_status}</span>
                        </div>
                      </td>
                      <td>
                        {voter.scheme_beneficiary ? 
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-medium border border-emerald-500/12">Yes</span> : 
                          <span className="text-dark-400 text-xs">No</span>
                        }
                      </td>
                      <td>
                        <div className="flex gap-2 justify-end">
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
        </div>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingVoter ? 'Edit Voter' : 'Add New Voter'}
        subtitle="Update voter information and support status"
        maxWidth="max-w-[800px]"
        footer={(
          <div className="flex gap-3 justify-end w-full">
            <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2.5 rounded-xl border border-dark-200 dark:border-white/10 text-dark-500 font-medium hover:bg-dark-50 transition-all">Cancel</button>
            <button type="submit" form="voter-form" className="px-8 py-2.5 rounded-xl bg-saffron-500 text-dark-950 font-medium shadow-lg shadow-saffron-500/20 hover:scale-105 active:scale-95 transition-all">
              {editingVoter ? 'Save Changes' : 'Register Voter'}
            </button>
          </div>
        )}
      >
        <form id="voter-form" onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-medium text-dark-400 uppercase tracking-widest px-1">Full Name *</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="form-input" placeholder="e.g. Rahul Kumar" required />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-medium text-dark-400 uppercase tracking-widest px-1">Voter ID Number</label>
              <input value={form.voter_id_number} onChange={e => setForm({...form, voter_id_number: e.target.value})} className="form-input" placeholder="XYZ1234567" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-medium text-dark-400 uppercase tracking-widest px-1">Phone</label>
              <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="form-input" placeholder="+91 0000000000" />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-medium text-dark-400 uppercase tracking-widest px-1">Age</label>
              <input type="number" value={form.age} onChange={e => setForm({...form, age: e.target.value})} className="form-input" placeholder="18" />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-medium text-dark-400 uppercase tracking-widest px-1">Gender</label>
              <select value={form.gender} onChange={e => setForm({...form, gender: e.target.value})} className="form-input">
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-medium text-dark-400 uppercase tracking-widest px-1">Full Address</label>
            <input value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="form-input" placeholder="House No, Street, Landmark, Area..." />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-medium text-dark-400 uppercase tracking-widest px-1">Caste / Community</label>
              <input value={form.caste} onChange={e => setForm({...form, caste: e.target.value})} className="form-input" placeholder="e.g. General" />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-medium text-dark-400 uppercase tracking-widest px-1">Support Status</label>
              <select value={form.support_status} onChange={e => setForm({...form, support_status: e.target.value})} className="form-input">
                <option value="unknown">Unknown</option>
                <option value="supporter">Supporter</option>
                <option value="neutral">Neutral</option>
                <option value="opponent">Opponent</option>
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
                <span className="text-sm font-medium text-dark-600 dark:text-dark-400 group-hover:text-dark-200 transition-colors">Scheme Beneficiary</span>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-medium text-dark-400 uppercase tracking-widest px-1">Remarks & Tactical Notes</label>
            <textarea value={form.remarks} onChange={e => setForm({...form, remarks: e.target.value})} className="form-input h-24 resize-none" placeholder="Add observations..." />
          </div>
        </form>
      </Modal>
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
