'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { votersAPI } from '@/lib/api';
import { Voter } from '@/types';
import { Plus, Search, Edit3, Trash2, X, Loader2, UserPlus } from 'lucide-react';
import Modal from '@/components/Modal';

export default function VotersPage() {
  const [voters, setVoters] = useState<Voter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingVoter, setEditingVoter] = useState<Voter | null>(null);
  const [search, setSearch] = useState('');
  const [supportFilter, setSupportFilter] = useState('');
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });

  const [form, setForm] = useState({
    voter_id_number: '', name: '', phone: '', address: '', age: '',
    gender: '', caste: '', scheme_beneficiary: false, support_status: 'unknown', remarks: '',
  });

  const loadVoters = async (page = 1) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (search) params.search = search;
      if (supportFilter) params.support_status = supportFilter;
      const res = await votersAPI.getAll(params);
      setVoters(res.data.data);
      setMeta(res.data.meta);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadVoters(); }, [search, supportFilter, loadVoters]);

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
      loadVoters();
    } catch (err: any) { alert(err.response?.data?.message || 'Error'); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this voter?')) return;
    try { await votersAPI.delete(id); loadVoters(); } catch {}
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
      <div className="p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-xl font-bold">Voter Database <span className="text-dark-500 font-normal text-base">({meta.total})</span></h2>
          <button onClick={openCreate} className="btn-primary"><UserPlus className="w-4 h-4" /> Add Voter</button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search voters..." className="form-input pl-10" />
          </div>
          {['', 'supporter', 'neutral', 'opponent', 'unknown'].map(s => (
            <button key={s} onClick={() => setSupportFilter(s)}
              className={`filter-tab ${supportFilter === s ? 'active' : ''}`}>
              {s && <span className={`w-2 h-2 rounded-full ${supportDot(s)}`} />}
              {s ? s : 'All'}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr><th>Voter</th><th>Phone</th><th>Booth / Ward</th><th>Gender</th><th>Caste</th><th>Support</th><th>Beneficiary</th><th className="text-right">Actions</th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-saffron-400" /></td></tr>
                ) : voters.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-dark-500">No voters found</td></tr>
                ) : (
                  voters.map(voter => (
                    <tr key={voter.id}>
                      <td>
                        <div>
                          <div className="font-bold text-dark-900 dark:text-dark-100">{voter.name}</div>
                          {voter.voter_id_number && <div className="text-[10px] font-black uppercase tracking-widest text-dark-600 dark:text-dark-500">ID: {voter.voter_id_number}</div>}
                        </div>
                      </td>
                      <td className="text-dark-800 dark:text-dark-400 font-medium">{voter.phone || '—'}</td>
                      <td>
                        <div className="text-sm font-bold text-dark-900 dark:text-dark-300">{voter.booth_name || '—'}</div>
                        <div className="text-[11px] font-medium text-dark-600 dark:text-dark-500">{voter.ward_name || ''}</div>
                      </td>
                      <td className="text-dark-700 dark:text-dark-400 capitalize">{voter.gender || '—'}</td>
                      <td className="text-dark-700 dark:text-dark-400">{voter.caste || '—'}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${supportDot(voter.support_status)}`} />
                          <span className="text-sm font-bold capitalize text-dark-800 dark:text-dark-300">{voter.support_status}</span>
                        </div>
                      </td>
                      <td>{voter.scheme_beneficiary ? <span className="badge badge-success">Yes</span> : <span className="text-dark-600">No</span>}</td>
                      <td>
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => openEdit(voter)} className="btn-icon btn-secondary"><Edit3 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDelete(voter.id)} className="btn-icon bg-red-500/10 border border-red-500/20 text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingVoter ? 'Edit Voter' : 'Add New Voter'}
        subtitle="Update voter information and support status in the database"
        maxWidth="max-w-[800px]"
        footer={(
          <>
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary min-w-[120px]">Cancel</button>
            <button type="submit" form="voter-form" className="btn-primary min-w-[180px]">
              {editingVoter ? 'Save Changes' : 'Register Voter'}
            </button>
          </>
        )}
      >
        <form id="voter-form" onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Full Name *</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="form-input" placeholder="e.g. Rahul Kumar" required />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Voter ID Number</label>
              <input value={form.voter_id_number} onChange={e => setForm({...form, voter_id_number: e.target.value})} className="form-input" placeholder="XYZ1234567" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Phone</label>
              <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="form-input" placeholder="+91 0000000000" />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Age</label>
              <input type="number" value={form.age} onChange={e => setForm({...form, age: e.target.value})} className="form-input" placeholder="18" />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Gender</label>
              <select value={form.gender} onChange={e => setForm({...form, gender: e.target.value})} className="form-input">
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Full Address</label>
            <input value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="form-input" placeholder="House No, Street, Landmark, Area..." />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Caste / Community</label>
              <input value={form.caste} onChange={e => setForm({...form, caste: e.target.value})} className="form-input" placeholder="e.g. General" />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Support Status</label>
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
                <span className="text-sm font-medium text-dark-300 group-hover:text-dark-100 transition-colors">Scheme Beneficiary</span>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Remarks & Tactical Notes</label>
            <textarea value={form.remarks} onChange={e => setForm({...form, remarks: e.target.value})} className="form-input h-24 resize-none" placeholder="Add any specific observations or tactical details about this voter..." />
          </div>
        </form>
      </Modal>
    </>
  );
}
