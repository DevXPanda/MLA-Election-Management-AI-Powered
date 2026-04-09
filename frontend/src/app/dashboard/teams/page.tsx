'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { showToast } from '@/lib/toast';
import Header from '@/components/Header';
import { teamsAPI, usersAPI } from '@/lib/api';
import { TeamMember, User } from '@/types';
import { Plus, Trash2, X, Loader2, Users, UserPlus, ShieldAlert, Award, Grid } from 'lucide-react';
import Modal from '@/components/Modal';
import StatsSummary from '@/components/dashboard/StatsSummary';

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
    } catch (err: any) { 
      showToast.error(err.response?.data?.message || 'Error adding team member'); 
    }
  };

  const handleRemove = async (id: number) => {
    showToast.confirm(
      'Remove Member',
      'Are you sure you want to remove this member from the team? This will not delete their user account.',
      async () => {
        try { 
          await teamsAPI.remove(id); 
          loadMembers(); 
          loadStats(); 
          toast.success('Member removed from team');
        } catch (err) {
          showToast.error('Failed to remove team member');
        }
      },
      'Remove'
    );
  };

  return (
    <>
      <Header title="Team Management" subtitle="Manage field workers and team structure" />
      <div className="dashboard-container">
        {/* Force Summary Stats */}
        <StatsSummary 
          loading={loading && !stats}
          stats={[
            { label: 'Total Active', value: stats?.total_active || 0, icon: Users, color: 'text-blue-500', bgIcon: 'bg-blue-500/10' },
            { label: 'Ward Heads', value: stats?.by_designation?.find((d: any) => d.designation === 'Ward Head')?.count || 0, icon: ShieldAlert, color: 'text-saffron-500', bgIcon: 'bg-saffron-500/10' },
            { label: 'Leaders', value: members.filter(m => m.designation?.toLowerCase().includes('leader')).length || 0, icon: Award, color: 'text-emerald-500', bgIcon: 'bg-emerald-500/10' },
            { label: 'Areas Covered', value: stats?.by_constituency?.length || 0, icon: Grid, color: 'text-purple-500', bgIcon: 'bg-purple-500/10' },
          ]}
        />

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-medium">Field Operatives</h2>
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
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-saffron-500/80 to-blue-600/80 flex items-center justify-center text-white text-[11px] font-medium">
                            {m.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <div className="font-medium text-dark-900 dark:text-dark-100">{m.name}</div>
                            <div className="text-[10px] font-medium text-dark-600 dark:text-dark-500 uppercase tracking-widest mt-0.5">{m.phone}</div>
                          </div>
                        </div>
                      </td>
                      <td className="text-dark-700 dark:text-dark-400 font-medium">{m.role_name || '—'}</td>
                      <td className="text-dark-800 dark:text-dark-300 font-medium">{m.designation || '—'}</td>
                      <td className="text-dark-700 dark:text-dark-400">{m.leader_name || '—'}</td>
                      <td>
                        <div className="text-sm font-medium text-dark-900 dark:text-dark-300">{m.ward_name || '—'}</div>
                        <div className="text-[11px] font-normal text-dark-600 dark:text-dark-500">{m.booth_name || ''}</div>
                      </td>
                      <td><span className={`badge ${m.status === 'active' ? 'badge-success' : 'badge-neutral'} font-medium`}>{m.status}</span></td>
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
