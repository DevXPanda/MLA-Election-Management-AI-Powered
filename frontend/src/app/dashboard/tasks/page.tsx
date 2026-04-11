'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { showToast } from '@/lib/toast';
import Header from '@/components/Header';
import { tasksAPI, usersAPI, teamsAPI } from '@/lib/api';
import { Task, User } from '@/types';
import { Plus, Search, Edit3, Trash2, X, Loader2, CheckCircle2, Clock, Circle, AlertTriangle, ListTodo, Layout, Eye } from 'lucide-react';
import Modal from '@/components/Modal';
import { useAuth } from '@/context/AuthContext';
import StatsSummary from '@/components/dashboard/StatsSummary';
import { useCallback } from 'react';
import DetailsModal from '@/components/DetailsModal';
import { MODULE_HEADER, TASKS_UI, TASK_TYPE_OPTIONS, taskTypeLabel } from '@/lib/ui-labels';

export default function TasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedTaskDetail, setSelectedTaskDetail] = useState<Task | null>(null);
  const [taskDetailLoading, setTaskDetailLoading] = useState(false);
  const [teamLeaderOptions, setTeamLeaderOptions] = useState<{ id: number; name: string }[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [tasksStats, setTasksStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [form, setForm] = useState({
    title: '', description: '', type: 'door_to_door', assigned_to: '',
    priority: 'medium', status: 'pending', due_date: '',
    assigned_user_ids: [] as number[],
    assigner_remarks: '',
    expand_team_leader_id: '',
    assignee_remark_chunk: '',
  });

  const canManage = !!(user && ['super_admin', 'mla', 'campaign_manager', 'ward_head'].includes(user.role_name));

  useEffect(() => { 
    loadTasks(); 
    
    // Only fetch user list if current user has permission to assign tasks
    const canAssign = user && ['super_admin', 'mla', 'campaign_manager', 'ward_head'].includes(user.role_name);
    if (canAssign) {
      loadUsers();
      loadTeamLeaders();
    }
    loadTasksStats();
  }, [statusFilter, priorityFilter, user]);

  const loadTeamLeaders = async () => {
    try {
      const res = await teamsAPI.getAll({ limit: 500, status: 'active' });
      const rows = res.data.data as Array<{ team_leader_id?: number | null; leader_name?: string | null }>;
      const map = new Map<number, string>();
      for (const m of rows) {
        if (m.team_leader_id != null && m.leader_name) {
          map.set(m.team_leader_id, m.leader_name);
        }
      }
      setTeamLeaderOptions(
        Array.from(map.entries())
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    } catch {
      setTeamLeaderOptions([]);
    }
  };

  useEffect(() => {
    if (!selectedTask) {
      setSelectedTaskDetail(null);
      return;
    }
    let cancelled = false;
    setTaskDetailLoading(true);
    tasksAPI
      .getById(selectedTask.id)
      .then((res) => {
        if (!cancelled) setSelectedTaskDetail(res.data.data as Task);
      })
      .catch(() => {
        if (!cancelled) setSelectedTaskDetail(selectedTask);
      })
      .finally(() => {
        if (!cancelled) setTaskDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedTask]);

  const loadTasksStats = async () => {
    setStatsLoading(true);
    try {
      const res = await tasksAPI.getStats();
      setTasksStats(res.data.data);
    } catch { }
    finally { setStatsLoading(false); }
  };

  const loadUsers = async () => {
    try { 
      const res = await usersAPI.getAll({ limit: 100 }); 
      setUsers(res.data.data); 
    } catch (err) {
      console.warn('Could not load user list (insufficient permissions)');
    }
  };

  const loadTasks = async (page = 1) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      const res = await tasksAPI.getAll(params);
      setTasks(res.data.data);
      setMeta(res.data.meta);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditingTask(null);
    setForm({
      title: '', description: '', type: 'door_to_door', assigned_to: '', priority: 'medium', status: 'pending', due_date: '',
      assigned_user_ids: [], assigner_remarks: '', expand_team_leader_id: '', assignee_remark_chunk: '',
    });
    setShowModal(true);
  };

  const openEdit = (task: Task) => {
    setEditingTask(task);
    const ids = task.assignees?.length
      ? task.assignees.map((a) => a.id)
      : task.assigned_to
        ? [task.assigned_to]
        : [];
    setForm({
      title: task.title, description: task.description || '', type: task.type,
      assigned_to: task.assigned_to ? String(task.assigned_to) : '', priority: task.priority,
      status: task.status, due_date: task.due_date ? task.due_date.split('T')[0] : '',
      assigned_user_ids: ids,
      assigner_remarks: task.assigner_remarks || '',
      expand_team_leader_id: '',
      assignee_remark_chunk: '',
    });
    setShowModal(true);
  };

  const toggleTaskAssignee = (userId: number) => {
    setForm((prev) => ({
      ...prev,
      assigned_user_ids: prev.assigned_user_ids.includes(userId)
        ? prev.assigned_user_ids.filter((id) => id !== userId)
        : [...prev.assigned_user_ids, userId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTask && !canManage) {
        await tasksAPI.update(editingTask.id, {
          status: form.status,
          ...(form.assignee_remark_chunk.trim() ? { assignee_remarks: form.assignee_remark_chunk.trim() } : {}),
        });
      } else if (editingTask) {
        const assigned_to = form.assigned_user_ids.length ? form.assigned_user_ids[0] : null;
        const data: Record<string, unknown> = {
          title: form.title,
          description: form.description,
          type: form.type,
          priority: form.priority,
          status: form.status,
          due_date: form.due_date || null,
          assigned_to,
          assigned_user_ids: form.assigned_user_ids,
          assigner_remarks: form.assigner_remarks || null,
        };
        if (form.expand_team_leader_id) {
          data.expand_team_leader_id = parseInt(form.expand_team_leader_id, 10);
        }
        await tasksAPI.update(editingTask.id, data);
      } else {
        const assigned_to = form.assigned_user_ids.length ? form.assigned_user_ids[0] : null;
        const data: Record<string, unknown> = {
          title: form.title,
          description: form.description,
          type: form.type,
          priority: form.priority,
          due_date: form.due_date || null,
          assigned_to,
          assigned_user_ids: form.assigned_user_ids,
          assigner_remarks: form.assigner_remarks || null,
        };
        if (form.expand_team_leader_id) {
          data.expand_team_leader_id = parseInt(form.expand_team_leader_id, 10);
        }
        await tasksAPI.create(data);
      }
      setShowModal(false);
      loadTasks();
    } catch (err: any) {
      showToast.error(err.response?.data?.message || 'Error saving task');
    }
  };

  const handleDelete = async (id: number) => {
    showToast.confirm(
      'Delete Task',
      'Are you sure you want to delete this task? This action cannot be undone.',
      async () => {
        try { 
          await tasksAPI.delete(id); 
          loadTasks(); 
          toast.success('Task deleted');
        } catch (err) {
          showToast.error('Failed to delete task');
        }
      },
      'Delete'
    );
  };

  const quickStatus = async (id: number, status: string) => {
    try { await tasksAPI.update(id, { status }); loadTasks(); } catch {}
  };

  const priorityBadge = (p: string) => p === 'high' ? 'badge-danger' : p === 'medium' ? 'badge-warning' : 'badge-info';
  const statusIcon = (s: string) => {
    switch(s) {
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case 'in_progress': return <Clock className="w-4 h-4 text-blue-400" />;
      case 'cancelled': return <X className="w-4 h-4 text-red-400" />;
      default: return <Circle className="w-4 h-4 text-dark-500" />;
    }
  };

  return (
    <>
      <Header title={MODULE_HEADER.tasks.title} subtitle={MODULE_HEADER.tasks.subtitle} />
      <div className="dashboard-container">
        {/* Summary stats */}
        <StatsSummary 
          loading={statsLoading}
          stats={[
            { label: TASKS_UI.statsTotal, value: tasksStats?.total_tasks || 0, icon: ListTodo, color: 'text-blue-500', bgIcon: 'bg-blue-500/10' },
            { label: 'Completed', value: tasksStats?.status_breakdown?.find((s: any) => s.status === 'completed')?.count || 0, icon: CheckCircle2, color: 'text-emerald-500', bgIcon: 'bg-emerald-500/10' },
            { label: 'In Progress', value: tasksStats?.status_breakdown?.find((s: any) => s.status === 'in_progress')?.count || 0, icon: Clock, color: 'text-amber-500', bgIcon: 'bg-amber-500/10' },
            { label: 'Pending', value: tasksStats?.status_breakdown?.find((s: any) => s.status === 'pending')?.count || 0, icon: Layout, color: 'text-purple-500', bgIcon: 'bg-purple-500/10' },
          ]}
        />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-xl font-medium">{TASKS_UI.listHeading}</h2>
          {canManage && (
            <button onClick={openCreate} className="btn-primary"><Plus className="w-4 h-4" /> {TASKS_UI.createButton}</button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          {['', 'pending', 'in_progress', 'completed'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`filter-tab ${statusFilter === s ? 'filter-tab-active' : 'filter-tab-inactive'}`}>
              {s ? s.replace('_', ' ') : 'All'}
            </button>
          ))}
          <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="form-input max-w-[150px]">
            <option value="">All Priority</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        {/* Task Cards */}
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-saffron-400" /></div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-16 glass-card">
            <ListTaskIcon className="w-12 h-12 text-dark-700 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-dark-300">No tasks found</h3>
            <p className="text-dark-500 text-sm mt-1">Create your first task to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map(task => (
              <div key={task.id} className="glass-card-hover p-5 flex items-center gap-4">
                <button onClick={() => quickStatus(task.id, task.status === 'completed' ? 'pending' : 'completed')} className="flex-shrink-0">
                  {statusIcon(task.status)}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h4 className={`font-bold ${task.status === 'completed' ? 'line-through text-dark-400' : 'text-dark-900 dark:text-dark-100'}`}>{task.title}</h4>
                    <span className={`badge ${priorityBadge(task.priority)} text-[10px]`}>{task.priority}</span>
                    <span className="badge badge-neutral text-[10px]">{taskTypeLabel(task.type)}</span>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] font-bold uppercase tracking-wider text-dark-600 dark:text-dark-500">
                    {(task.assignees?.length
                      ? <span className="flex items-center gap-1">👤 {task.assignees.map((a) => a.name).join(', ')}</span>
                      : task.assigned_to_name
                        ? <span className="flex items-center gap-1">👤 {task.assigned_to_name}</span>
                        : null)}
                    {task.due_date && <span className="flex items-center gap-1">📅 {new Date(task.due_date).toLocaleDateString()}</span>}
                    {task.ward_name && <span className="flex items-center gap-1">📍 {task.ward_name}</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedTask(task)} className="btn-icon btn-secondary"><Eye className="w-3.5 h-3.5" /></button>
                  {(canManage || (user && (task.assigned_to === user.id || task.assignees?.some((a) => a.id === user.id)))) && (
                    <button onClick={() => openEdit(task)} className="btn-icon btn-secondary"><Edit3 className="w-3.5 h-3.5" /></button>
                  )}
                  {canManage && (
                    <button onClick={() => handleDelete(task.id)} className="btn-icon bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20"><Trash2 className="w-3.5 h-3.5" /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingTask && !canManage ? TASKS_UI.modalAssigneeTitle : editingTask ? TASKS_UI.modalEditTitle : TASKS_UI.modalCreateTitle}
        subtitle={MODULE_HEADER.tasks.subtitle}
        maxWidth="max-w-[700px]"
        footer={(
          <>
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary min-w-[120px]">Cancel</button>
            <button type="submit" form="task-form" className="btn-primary min-w-[180px]">
              {editingTask ? TASKS_UI.modalFooterSave : TASKS_UI.modalFooterCreate}
            </button>
          </>
        )}
      >
        <form id="task-form" onSubmit={handleSubmit} className="space-y-6">
          {editingTask && !canManage ? (
            <>
              <div className="space-y-2">
                <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Task Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="form-input">
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Your remarks</label>
                <textarea
                  value={form.assignee_remark_chunk}
                  onChange={(e) => setForm({ ...form, assignee_remark_chunk: e.target.value })}
                  className="form-input h-24 resize-none"
                  placeholder="Notes or comments for this task..."
                />
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Task Title *</label>
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="form-input" placeholder="e.g. Booth Outreach" required />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Task Type</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="form-input">
                    {TASK_TYPE_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Task Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="form-input h-24 resize-none" placeholder="Provide detailed instructions for the assignee..." />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Priority Level</label>
                  <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="form-input">
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Add team by leader</label>
                  <select
                    value={form.expand_team_leader_id}
                    onChange={(e) => setForm({ ...form, expand_team_leader_id: e.target.value })}
                    className="form-input"
                  >
                    <option value="">None</option>
                    {teamLeaderOptions.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Assign to users</label>
                <div className="max-h-[200px] overflow-y-auto pr-1 grid grid-cols-1 gap-2 custom-scrollbar border border-dark-100 dark:border-white/10 rounded-lg p-2">
                  {users.map((u) => (
                    <label
                      key={u.id}
                      className={`flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer ${
                        form.assigned_user_ids.includes(u.id) ? 'border-saffron-500 bg-saffron-500/5' : 'border-dark-100 dark:border-white/5'
                      }`}
                    >
                      <span className="text-xs font-bold text-dark-700 dark:text-dark-300">{u.name}</span>
                      <input
                        type="checkbox"
                        checked={form.assigned_user_ids.includes(u.id)}
                        onChange={() => toggleTaskAssignee(u.id)}
                        className="w-4 h-4 rounded border-dark-300 text-saffron-600"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Assigner remarks / notes</label>
                <textarea
                  value={form.assigner_remarks}
                  onChange={(e) => setForm({ ...form, assigner_remarks: e.target.value })}
                  className="form-input h-20 resize-none"
                  placeholder="Instructions or context for assignees..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Due Date</label>
                  <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="form-input" />
                </div>
                {editingTask && (
                  <div className="space-y-2">
                    <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Task Status</label>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="form-input">
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                )}
              </div>
            </>
          )}
        </form>
      </Modal>

      <DetailsModal
        isOpen={!!selectedTask}
        onClose={() => { setSelectedTask(null); setSelectedTaskDetail(null); }}
        title={TASKS_UI.detailsTitle}
        subtitle={TASKS_UI.detailsSubtitle}
        items={(() => {
          const td = selectedTaskDetail || selectedTask;
          const assigneeLine =
            td?.assignees?.length ? td.assignees.map((a) => a.name).join(', ') : td?.assigned_to_name || 'Unassigned';
          return [
            { label: 'Name', value: td?.title },
            { label: 'Assignees', value: assigneeLine },
            { label: 'Type', value: td?.type ? taskTypeLabel(td.type) : '—' },
            { label: 'Assigned by', value: td?.assigned_by_name || '—' },
            { label: 'Ward', value: td?.ward_name || '—' },
            { label: 'Booth', value: td?.booth_name || '—' },
            { label: 'Constituency', value: td?.constituency_name || '—' },
            { label: 'Priority', value: td?.priority || '—' },
            { label: 'Status', value: td?.status || '—' },
            { label: 'Late completion', value: td?.is_late_completion ? 'Yes' : 'No' },
            { label: 'Due Date', value: td?.due_date ? new Date(td.due_date).toLocaleString() : '—' },
            { label: 'End date (completed)', value: td?.completed_at ? new Date(td.completed_at).toLocaleString() : '—' },
            { label: 'Completed by', value: td?.completed_by_name || '—' },
            { label: 'Assigner remarks', value: td?.assigner_remarks || '—' },
            { label: 'Assignee remarks', value: td?.assignee_remarks || '—' },
            { label: 'Description', value: td?.description || '—' },
          ];
        })()}
        extra={
          <>
            {taskDetailLoading && (
              <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-saffron-400" />
              </div>
            )}
            {selectedTaskDetail?.activity && selectedTaskDetail.activity.length > 0 && (
              <div className="rounded-lg border border-dark-100 dark:border-white/10 bg-dark-50/40 dark:bg-white/[0.02] p-3">
                <p className="text-[10px] uppercase tracking-widest text-dark-500 mb-2">Activity log</p>
                <ul className="space-y-2 text-xs text-dark-700 dark:text-dark-300 max-h-48 overflow-y-auto">
                  {selectedTaskDetail.activity.map((row) => (
                    <li key={row.id} className="border-b border-dark-100/80 dark:border-white/5 pb-2 last:border-0">
                      <span className="font-semibold text-dark-900 dark:text-dark-100">{row.action}</span>
                      {row.user_name && <span className="text-dark-500"> · {row.user_name}</span>}
                      <span className="text-dark-500"> · {new Date(row.created_at).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        }
      />
    </>
  );
}

function ListTaskIcon({ className }: { className?: string }) {
  return <AlertTriangle className={className} />;
}
