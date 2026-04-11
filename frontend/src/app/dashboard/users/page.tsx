'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { showToast } from '@/lib/toast';
import Header from '@/components/Header';
import { usersAPI } from '@/lib/api';
import { User, Role } from '@/types';
import { Plus, Search, Edit3, Trash2, X, Loader2, UserPlus, Filter, Eye } from 'lucide-react';
import Modal from '@/components/Modal';
import DetailsModal from '@/components/DetailsModal';
import { MODULE_HEADER } from '@/lib/ui-labels';

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });

  // Form state
  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '', role_id: '',
    constituency_id: '', ward_id: '', booth_id: '', status: 'active',
  });

  useEffect(() => {
    loadUsers();
    loadRoles();
  }, [search, roleFilter, statusFilter]);

  const loadRoles = async () => {
    try {
      const res = await usersAPI.getRoles();
      setRoles(res.data.data);
    } catch (err) { console.error(err); }
  };

  const loadUsers = async (page = 1) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await usersAPI.getAll(params);
      setUsers(res.data.data);
      setMeta(res.data.meta);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditingUser(null);
    setForm({ name: '', email: '', phone: '', password: '', role_id: '', constituency_id: '', ward_id: '', booth_id: '', status: 'active' });
    setShowModal(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setForm({
      name: user.name, email: user.email, phone: user.phone || '', password: '',
      role_id: String(user.role_id), constituency_id: '', ward_id: '', booth_id: '',
      status: user.status,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = { ...form, role_id: parseInt(form.role_id) || undefined };
      if (editingUser) {
        await usersAPI.update(editingUser.id, data);
      } else {
        await usersAPI.create(data);
      }
      setShowModal(false);
      loadUsers();
    } catch (err: any) {
      showToast.error(err.response?.data?.message || 'Error saving user');
    }
  };

  const handleDelete = async (id: number) => {
    showToast.confirm(
      'Delete User',
      'Are you sure you want to delete this user account? This access will be immediately revoked.',
      async () => {
        try {
          await usersAPI.delete(id);
          loadUsers();
          toast.success('User deleted successfully');
        } catch (err: any) {
          showToast.error(err.response?.data?.message || 'Error deleting user');
        }
      },
      'Delete'
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return 'badge-success';
      case 'inactive': return 'badge-danger';
      default: return 'badge-neutral';
    }
  };

  return (
    <>
      <Header title={MODULE_HEADER.users.title} subtitle={MODULE_HEADER.users.subtitle} />
      <div className="dashboard-container">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold">All Users</h2>
            <p className="text-sm text-dark-600 dark:text-dark-500 mt-1 font-medium">{meta.total} users total</p>
          </div>
          <button onClick={openCreate} className="btn-primary">
            <UserPlus className="w-4 h-4" /> Add User
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users by name, email, phone..."
              className="form-input pl-10"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="form-input max-w-[180px]"
          >
            <option value="">All Roles</option>
            {roles.map(r => <option key={r.id} value={r.name}>{r.display_name}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="form-input max-w-[150px]"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {/* Table Container with Horizontal Scroll */}
        <div className="glass-card table-responsive">
          <table className="data-table">
            <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Phone</th>
                  <th>Constituency</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-saffron-400" />
                  </td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-dark-500">No users found</td></tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div 
                          className="flex items-center gap-3 cursor-pointer group/user"
                          onClick={() => openEdit(user)}
                          title="Click to edit user"
                        >
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-saffron-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 group-hover/user:scale-110 transition-transform shadow-md shadow-saffron-500/10">
                            {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <div className="font-bold text-dark-900 dark:text-dark-100 group-hover/user:text-saffron-500 transition-colors">{user.name}</div>
                            <div className="text-[11px] font-bold text-dark-600 dark:text-dark-500 uppercase tracking-wider">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td><span className="badge badge-primary">{user.role_display_name || user.role_name}</span></td>
                      <td className="text-dark-700 dark:text-dark-400 font-medium">{user.phone || '—'}</td>
                      <td className="text-dark-700 dark:text-dark-400">{user.constituency_name || '—'}</td>
                      <td><span className={`badge ${getStatusBadge(user.status)}`}>{user.status}</span></td>
                      <td className="text-dark-600 dark:text-dark-500 text-xs font-bold uppercase tracking-tighter">
                        {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                      </td>
                      <td>
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setSelectedUser(user)} className="btn-icon btn-secondary" title="View details">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => openEdit(user)} className="btn-icon btn-secondary">
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(user.id)} className="btn-icon bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20">
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

          {/* Pagination */}
          {meta.totalPages > 1 && (
            <div className="p-4 border-t border-white/5 flex items-center justify-center gap-2">
              {[...Array(meta.totalPages)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => loadUsers(i + 1)}
                  className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                    meta.page === i + 1
                      ? 'bg-saffron-500 text-white'
                      : 'text-dark-400 hover:bg-dark-800'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingUser ? 'Edit User' : 'Add New User'}
        subtitle={editingUser ? 'Update existing user account details' : 'Fill in the information below to create a new user account'}
        maxWidth="max-w-[700px]"
        footer={(
          <>
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary min-w-[120px]">Cancel</button>
            <button type="submit" form="user-form" className="btn-primary min-w-[160px]">
              {editingUser ? 'Save Changes' : 'Create Account'}
            </button>
          </>
        )}
      >
        <form id="user-form" onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Full Name *</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="form-input" placeholder="e.g. John Doe" required />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Email *</label>
              <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="form-input" placeholder="john@example.com" required />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Phone</label>
              <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="form-input" placeholder="+91 0000000000" />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">{editingUser ? 'New Password' : 'Password *'}</label>
              <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="form-input" placeholder="••••••••" required={!editingUser} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Role *</label>
              <select value={form.role_id} onChange={e => setForm({...form, role_id: e.target.value})} className="form-input" required>
                <option value="">Select a role</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.display_name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Account Status</label>
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="form-input">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </form>
      </Modal>

      <DetailsModal
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title="User Details"
        subtitle="Identity, access role, and geography mapping"
        items={[
          { label: 'Name', value: selectedUser?.name },
          { label: 'Role', value: selectedUser?.role_display_name || selectedUser?.role_name || '—' },
          { label: 'Designation', value: selectedUser?.role_display_name || '—' },
          { label: 'Assigned Leader', value: '—' },
          { label: 'Ward', value: selectedUser?.ward_name || '—' },
          { label: 'Booth', value: selectedUser?.booth_name || '—' },
          { label: 'Constituency', value: selectedUser?.constituency_name || '—' },
          { label: 'Area', value: selectedUser?.area_name || '—' },
          { label: 'Phone', value: selectedUser?.phone || '—' },
          { label: 'Email', value: selectedUser?.email || '—' },
          { label: 'Status', value: selectedUser?.status || '—' },
          { label: 'Last Login', value: selectedUser?.last_login ? new Date(selectedUser.last_login).toLocaleString() : 'Never' },
          { label: 'Created At', value: selectedUser?.created_at ? new Date(selectedUser.created_at).toLocaleString() : '—' },
        ]}
      />
    </>
  );
}
