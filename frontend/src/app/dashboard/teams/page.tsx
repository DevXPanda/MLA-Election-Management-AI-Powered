'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { teamsAPI, usersAPI } from '@/lib/api';
import { TeamMember, User } from '@/types';
import { Plus, Trash2, X, Loader2, Users, UserPlus } from 'lucide-react';
import Modal from '@/components/Modal';

export default function TeamsPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [form, setForm] = useState({ user_id: '', designation: '', team_leader_id: '' });

  useEffect(() => { loadMembers(); loadUsers(); loadStats(); }, []);

  const loadMembers = async () => {
    setLoading(true);
    try { const res = await teamsAPI.getAll(); setMembers(res.data.data); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadUsers = async () => {
    try { const res = await usersAPI.getAll({ limit: 100 }); setUsers(res.data.data); } catch {}
  };

  const loadStats = async () => {
    try { const res = await teamsAPI.getStats(); setStats(res.data.data); } catch {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await teamsAPI.add({
        user_id: parseInt(form.user_id),
        designation: form.designation || null,
        team_leader_id: form.team_leader_id ? parseInt(form.team_leader_id) : null,
      });
      setShowModal(false);
      loadMembers();
      loadStats();
    } catch (err: any) { alert(err.response?.data?.message || 'Error'); }
  };

  const handleRemove = async (id: number) => {
    if (!confirm('Remove this team member?')) return;
    try { await teamsAPI.remove(id); loadMembers(); loadStats(); } catch {}
  };

  return (
    <>
      <Header title="Team Management" subtitle="Manage field workers and team structure" />
      <div className="p-8">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
            <div className="glass-card p-6 text-center shadow-md dark:shadow-none border-dark-100 dark:border-white/5">
              <div className="text-3xl font-extrabold text-gradient">{stats.total_active}</div>
              <div className="text-[11px] font-black uppercase tracking-[2px] text-dark-600 dark:text-dark-400 mt-1">Active Members</div>
            </div>
            <div className="glass-card p-6 border-dark-100 dark:border-white/5 shadow-md dark:shadow-none">
              <h4 className="text-[11px] font-black uppercase tracking-[2px] text-dark-800 dark:text-dark-300 mb-4 flex items-center gap-2">
                <div className="w-1.5 h-4 bg-saffron-500 rounded-full" /> By Constituency
              </h4>
              <div className="space-y-3">
                {stats.by_constituency.slice(0, 4).map((c: any) => (
                  <div key={c.name} className="flex justify-between text-xs py-1 border-b border-dark-50 dark:border-white/5 last:border-0">
                    <span className="font-bold text-dark-700 dark:text-dark-400">{c.name}</span>
                    <span className="font-black text-dark-900 dark:text-dark-100">{c.count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="glass-card p-6 border-dark-100 dark:border-white/5 shadow-md dark:shadow-none">
              <h4 className="text-[11px] font-black uppercase tracking-[2px] text-dark-800 dark:text-dark-300 mb-4 flex items-center gap-2">
                <div className="w-1.5 h-4 bg-blue-500 rounded-full" /> By Designation
              </h4>
              <div className="space-y-3">
                {stats.by_designation.slice(0, 4).map((d: any) => (
                  <div key={d.designation} className="flex justify-between text-xs py-1 border-b border-dark-50 dark:border-white/5 last:border-0">
                    <span className="font-bold text-dark-700 dark:text-dark-400 capitalize">{d.designation || 'None'}</span>
                    <span className="font-black text-dark-900 dark:text-dark-100">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Team Members</h2>
          <button onClick={() => setShowModal(true)} className="btn-primary"><UserPlus className="w-4 h-4" /> Add Member</button>
        </div>

        {/* Table */}
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr><th>Member</th><th>Role</th><th>Designation</th><th>Leader</th><th>Ward / Booth</th><th>Status</th><th className="text-right">Actions</th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-saffron-400" /></td></tr>
                ) : members.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-dark-500">No team members</td></tr>
                ) : (
                  members.map(m => (
                    <tr key={m.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-saffron-500/80 to-blue-600/80 flex items-center justify-center text-white text-[11px] font-bold">
                            {m.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <div className="font-bold text-dark-900 dark:text-dark-100">{m.name}</div>
                            <div className="text-[10px] font-bold text-dark-600 dark:text-dark-500 uppercase tracking-widest mt-0.5">{m.phone}</div>
                          </div>
                        </div>
                      </td>
                      <td className="text-dark-700 dark:text-dark-400 font-medium">{m.role_name || '—'}</td>
                      <td className="text-dark-800 dark:text-dark-300 font-bold">{m.designation || '—'}</td>
                      <td className="text-dark-700 dark:text-dark-400">{m.leader_name || '—'}</td>
                      <td>
                        <div className="text-sm font-bold text-dark-900 dark:text-dark-300">{m.ward_name || '—'}</div>
                        <div className="text-[11px] font-medium text-dark-600 dark:text-dark-500">{m.booth_name || ''}</div>
                      </td>
                      <td><span className={`badge ${m.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>{m.status}</span></td>
                      <td className="text-right">
                        <button onClick={() => handleRemove(m.id)} className="btn-icon bg-red-500/10 border border-red-500/20 text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
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
        title="Add Team Member"
        subtitle="Onboard new field workers and assign tactical roles"
        footer={(
          <>
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary min-w-[120px]">Cancel</button>
            <button type="submit" form="add-member-form" className="btn-primary min-w-[160px]">
              Add to Team
            </button>
          </>
        )}
      >
        <form id="add-member-form" onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Select User Profile *</label>
            <select value={form.user_id} onChange={e => setForm({...form, user_id: e.target.value})} className="form-input" required>
              <option value="">Search and choose a user...</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Tactical Designation</label>
            <input value={form.designation} onChange={e => setForm({...form, designation: e.target.value})} placeholder="e.g. Ward Coordinator" className="form-input" />
          </div>
          
          <div className="space-y-2">
            <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Reporting Officer / Team Leader</label>
            <select value={form.team_leader_id} onChange={e => setForm({...form, team_leader_id: e.target.value})} className="form-input">
              <option value="">No Reporting Officer</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        </form>
      </Modal>
    </>
  );
}
