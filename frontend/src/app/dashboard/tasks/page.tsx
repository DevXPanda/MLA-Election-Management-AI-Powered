'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { tasksAPI, usersAPI } from '@/lib/api';
import { Task, User } from '@/types';
import { Plus, Search, Edit3, Trash2, X, Loader2, CheckCircle2, Clock, Circle, AlertTriangle } from 'lucide-react';
import Modal from '@/components/Modal';

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });

  const [form, setForm] = useState({
    title: '', description: '', type: 'door_to_door', assigned_to: '',
    priority: 'medium', status: 'pending', due_date: '',
  });

  useEffect(() => { loadTasks(); loadUsers(); }, [statusFilter, priorityFilter]);

  const loadUsers = async () => {
    try { const res = await usersAPI.getAll({ limit: 100 }); setUsers(res.data.data); } catch {}
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
    setForm({ title: '', description: '', type: 'door_to_door', assigned_to: '', priority: 'medium', status: 'pending', due_date: '' });
    setShowModal(true);
  };

  const openEdit = (task: Task) => {
    setEditingTask(task);
    setForm({
      title: task.title, description: task.description || '', type: task.type,
      assigned_to: task.assigned_to ? String(task.assigned_to) : '', priority: task.priority,
      status: task.status, due_date: task.due_date ? task.due_date.split('T')[0] : '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = { ...form, assigned_to: form.assigned_to ? parseInt(form.assigned_to) : null };
      if (editingTask) {
        await tasksAPI.update(editingTask.id, data);
      } else {
        await tasksAPI.create(data);
      }
      setShowModal(false);
      loadTasks();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error saving task');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this task?')) return;
    try { await tasksAPI.delete(id); loadTasks(); } catch {}
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

  const taskTypes = [
    { value: 'door_to_door', label: 'Door-to-Door' },
    { value: 'survey_collection', label: 'Survey Collection' },
    { value: 'event_participation', label: 'Event Participation' },
    { value: 'voter_outreach', label: 'Voter Outreach' },
    { value: 'report_submission', label: 'Report Submission' },
  ];

  return (
    <>
      <Header title="Task Management" subtitle="Assign and track campaign tasks" />
      <div className="p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-xl font-bold">All Tasks <span className="text-dark-500 font-normal text-base">({meta.total})</span></h2>
          <button onClick={openCreate} className="btn-primary"><Plus className="w-4 h-4" /> Create Task</button>
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
                    <span className="badge badge-neutral text-[10px]">{task.type.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] font-bold uppercase tracking-wider text-dark-600 dark:text-dark-500">
                    {task.assigned_to_name && <span className="flex items-center gap-1">👤 {task.assigned_to_name}</span>}
                    {task.due_date && <span className="flex items-center gap-1">📅 {new Date(task.due_date).toLocaleDateString()}</span>}
                    {task.ward_name && <span className="flex items-center gap-1">📍 {task.ward_name}</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(task)} className="btn-icon btn-secondary"><Edit3 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(task.id)} className="btn-icon bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingTask ? 'Edit Task' : 'Create New Mission'}
        subtitle="Assign and manage mission-critical tasks for field workers"
        maxWidth="max-w-[700px]"
        footer={(
          <>
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary min-w-[120px]">Cancel</button>
            <button type="submit" form="task-form" className="btn-primary min-w-[180px]">
              {editingTask ? 'Save Changes' : 'Create & Assign Mission'}
            </button>
          </>
        )}
      >
        <form id="task-form" onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Task Title *</label>
              <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="form-input" placeholder="e.g. Booth Outreach" required />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Task Type</label>
              <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="form-input">
                {taskTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Task Description</label>
            <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="form-input h-24 resize-none" placeholder="Provide detailed instructions for the assignee..." />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Priority Level</label>
              <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})} className="form-input">
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Assign To</label>
              <select value={form.assigned_to} onChange={e => setForm({...form, assigned_to: e.target.value})} className="form-input">
                <option value="">No Assignment</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Due Date</label>
              <input type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} className="form-input" />
            </div>
            {editingTask && (
              <div className="space-y-2">
                <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Task Status</label>
                <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="form-input">
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            )}
          </div>
        </form>
      </Modal>
    </>
  );
}

function ListTaskIcon({ className }: { className?: string }) {
  return <AlertTriangle className={className} />;
}
