'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { showToast } from '@/lib/toast';
import Header from '@/components/Header';
import { teamsAPI, usersAPI, workAllocationAPI } from '@/lib/api';
import { TeamMember, User, WorkAllocation } from '@/types';
import { Plus, Trash2, X, Loader2, Users, UserPlus, ShieldAlert, Award, Grid, Eye } from 'lucide-react';
import Modal from '@/components/Modal';
import StatsSummary from '@/components/dashboard/StatsSummary';
import DetailsModal from '@/components/DetailsModal';
import { MODULE_HEADER, SHARED_UI, TEAMS_UI } from '@/lib/ui-labels';
import { useLanguage } from '@/context/LanguageContext';

export default function TeamsPage() {
  const { t, language } = useLanguage();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [form, setForm] = useState({ user_id: '', designation: '', team_leader_id: '' });
  const [memberAllocations, setMemberAllocations] = useState<WorkAllocation[]>([]);
  const [loadingAllocations, setLoadingAllocations] = useState(false);

  useEffect(() => { loadMembers(); loadUsers(); loadStats(); }, []);

  useEffect(() => {
    if (selectedMember) {
      setLoadingAllocations(true);
      workAllocationAPI.getAll({ user_id: selectedMember.user_id })
        .then(res => {
          setMemberAllocations(res.data.data);
        })
        .catch(err => {
          console.error('Failed to load member allocations:', err);
        })
        .finally(() => {
          setLoadingAllocations(false);
        });
    } else {
      setMemberAllocations([]);
    }
  }, [selectedMember]);

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
      showToast.error(err.response?.data?.message || t('toast.error_save', 'Failed to save details')); 
    }
  };

  const handleRemove = async (id: number) => {
    showToast.confirm(
      t('teams.remove_member', 'Remove Member'),
      t('teams.remove_confirm_msg', 'Are you sure you want to remove this member from the team? This will not delete their user account.'),
      async () => {
        try { 
          await teamsAPI.remove(id); 
          loadMembers(); 
          loadStats(); 
          toast.success(t('teams.remove_success', 'Member removed from team'));
        } catch (err) {
          showToast.error(t('teams.remove_failed', 'Failed to remove team member'));
        }
      },
      t('action.delete', 'Remove')
    );
  };

  return (
    <>
      <Header title={MODULE_HEADER.teams.title} subtitle={MODULE_HEADER.teams.subtitle} />
      <div className="dashboard-container">
        {/* Force Summary Stats */}
        <StatsSummary 
          loading={loading && !stats}
          stats={[
            { label: t('teams.total_active', 'Total Active'), value: stats?.total_active || 0, icon: Users, color: 'text-blue-500', bgIcon: 'bg-blue-500/10' },
            { label: t('teams.ward_heads', 'Ward Heads'), value: stats?.by_designation?.find((d: any) => d.designation === 'Ward Head')?.count || 0, icon: ShieldAlert, color: 'text-saffron-500', bgIcon: 'bg-saffron-500/10' },
            { label: t('teams.leaders', 'Leaders'), value: members.filter(m => m.designation?.toLowerCase().includes('leader')).length || 0, icon: Award, color: 'text-emerald-500', bgIcon: 'bg-emerald-500/10' },
            { label: t('teams.areas_covered', 'Areas Covered'), value: stats?.by_constituency?.length || 0, icon: Grid, color: 'text-purple-500', bgIcon: 'bg-purple-500/10' },
          ]}
        />

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-medium">{TEAMS_UI.listHeading}</h2>
          <button onClick={() => setShowModal(true)} className="btn-primary"><UserPlus className="w-4 h-4" /> {TEAMS_UI.addMember}</button>
        </div>

        {/* Table Container with Horizontal Scroll */}
        <div className="glass-card table-responsive">
          <table className="data-table">
            <thead>
                <tr><th>{t('teams.table_member', 'Member')}</th><th>{t('teams.table_role', 'Role')}</th><th>{t('teams.table_designation', 'Designation')}</th><th>{t('teams.table_leader', 'Leader')}</th><th>{t('teams.table_ward_booth', 'Ward / Booth')}</th><th>{t('teams.table_status', 'Status')}</th><th className="text-right">{t('label.actions', 'Actions')}</th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-saffron-400" /></td></tr>
                ) : members.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-dark-500">{t('teams.no_team_members', 'No team members')}</td></tr>
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
                      <td><span className={`badge ${m.status === 'active' ? 'badge-success' : 'badge-neutral'} font-medium`}>{t('label.' + m.status, m.status)}</span></td>
                      <td className="text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => setSelectedMember(m)} className="btn-icon btn-secondary" title="View details">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleRemove(m.id)} className="btn-icon bg-red-500/10 border border-red-500/20 text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
          </table>
        </div>
        </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={t('teams.add_team_member', 'Add Team Member')}
        subtitle={t('teams.add_member_subtitle', 'Onboard new field workers and assign tactical roles')}
        footer={(
          <>
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary min-w-[120px]">{t('action.cancel', 'Cancel')}</button>
            <button type="submit" form="add-member-form" className="btn-primary min-w-[160px]">
              {t('teams.add_to_team_btn', 'Add to Team')}
            </button>
          </>
        )}
      >
        <form id="add-member-form" onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">{t('teams.select_user_profile', 'Select User Profile *')}</label>
            <select value={form.user_id} onChange={e => setForm({...form, user_id: e.target.value})} className="form-input" required>
              <option value="">{t('teams.search_choose_user', 'Search and choose a user...')}</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">{SHARED_UI.teamsDesignation}</label>
            <input value={form.designation} onChange={e => setForm({...form, designation: e.target.value})} placeholder="e.g. Ward Coordinator" className="form-input" />
          </div>
          
          <div className="space-y-2">
            <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">{t('teams.reporting_officer', 'Reporting Officer / Team Leader')}</label>
            <select value={form.team_leader_id} onChange={e => setForm({...form, team_leader_id: e.target.value})} className="form-input">
              <option value="">{t('teams.no_reporting_officer', 'No Reporting Officer')}</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        </form>
      </Modal>

      <DetailsModal
        isOpen={!!selectedMember}
        onClose={() => setSelectedMember(null)}
        title={t('teams.details_title', 'Team Member Details')}
        subtitle={t('teams.details_subtitle', 'Operational profile and assignment details')}
        items={[
          { label: t('label.name', 'Name'), value: selectedMember?.name },
          { label: t('label.role', 'Role'), value: selectedMember?.role_name || '—' },
          { label: t('teams.table_designation', 'Designation'), value: selectedMember?.designation || '—' },
          { label: t('voters.assigned_leader', 'Assigned Leader'), value: selectedMember?.leader_name || '—' },
          { label: t('label.ward', 'Ward'), value: selectedMember?.ward_name || '—' },
          { label: t('label.booth', 'Booth'), value: selectedMember?.booth_name || '—' },
          { label: t('label.constituency', 'Constituency'), value: selectedMember?.constituency_name || '—' },
          { label: t('label.phone', 'Phone'), value: selectedMember?.phone || '—' },
          { label: t('label.email', 'Email'), value: selectedMember?.email || '—' },
          { label: t('label.status', 'Status'), value: selectedMember?.status ? t('label.' + selectedMember.status, selectedMember.status) : '—' },
          { label: t('teams.joined_at', 'Joined At'), value: selectedMember?.joined_at ? new Date(selectedMember.joined_at).toLocaleString(language === 'hi' ? 'hi-IN' : 'en-US') : '—' },
        ]}
        extra={
          <div className="rounded-lg border border-dark-100 dark:border-white/10 bg-dark-50/40 dark:bg-white/[0.02] p-4">
            <p className="text-[10px] uppercase tracking-widest text-dark-500 mb-3 font-black">
              {t('users.assigned_tasks', 'Assigned Work Allocations')}
            </p>
            {loadingAllocations ? (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 border-2 border-dark-750 border-t-saffron-500 rounded-full animate-spin" />
              </div>
            ) : memberAllocations.length === 0 ? (
              <p className="text-xs text-dark-500 italic py-2">
                {t('users.no_tasks', 'No work allocations assigned to this user.')}
              </p>
            ) : (
              <div className="space-y-2 max-h-[250px] overflow-y-auto custom-scrollbar">
                {memberAllocations.map(alloc => (
                  <div key={alloc.id} className="flex justify-between items-center p-2.5 rounded-lg border border-dark-100 dark:border-white/5 bg-white dark:bg-dark-950/40 text-xs">
                    <div>
                      <div className="font-bold text-dark-900 dark:text-dark-100 uppercase tracking-tight">
                        {alloc.event_title}
                      </div>
                      <div className="text-[10px] text-dark-600 dark:text-dark-400 mt-0.5">
                        {alloc.work_type} • Due: {alloc.due_date ? new Date(alloc.due_date).toLocaleDateString() : '—'}
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${
                      alloc.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                      alloc.status === 'in_progress' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                      alloc.status === 'overdue' ? 'bg-red-500/20 text-red-500 border-red-500/30' :
                      alloc.status === 'assigned' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                      alloc.status === 'cancelled' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                      'bg-dark-500/10 text-dark-500 border-dark-500/20'
                    }`}>
                      {t(`label.${alloc.status}`, alloc.status)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        }
      />
    </>
  );
}
