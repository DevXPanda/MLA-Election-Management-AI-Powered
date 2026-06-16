'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { showToast } from '@/lib/toast';
import Header from '@/components/Header';
import { usersAPI, constituencyAPI, partyMembersAPI } from '@/lib/api';
import { User, Role } from '@/types';
import { Plus, Search, Edit3, Trash2, X, Loader2, UserPlus, Filter, Eye } from 'lucide-react';
import Modal from '@/components/Modal';
import DetailsModal from '@/components/DetailsModal';
import { useLanguage } from '@/context/LanguageContext';
import { MODULE_HEADER } from '@/lib/ui-labels';

export default function UsersPage() {
  const { t, language } = useLanguage();
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
  // Form state
  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '', role_id: '',
    constituency_id: '', ward_id: '', booth_id: '', status: 'active',
    address: '', qualification: '', profession: '', age: '', gender: '',
    support_preference: 'Neutral', photo_url: '',
  });

  const [wards, setWards] = useState<any[]>([]);
  const [booths, setBooths] = useState<any[]>([]);

  const [constituencyList, setConstituencyList] = useState<any[]>([]);
  const [constituencySearch, setConstituencySearch] = useState('');
  const [showConstDropdown, setShowConstDropdown] = useState(false);

  const selectedRole = roles.find(r => String(r.id) === String(form.role_id));
  const isMlaRole = selectedRole?.name === 'mla';

  useEffect(() => {
    constituencyAPI.getConstituencies().then(res => {
      setConstituencyList(res.data.data);
    }).catch(err => console.error(err));
  }, []);

  useEffect(() => {
    if (form.role_id === 'party_member') {
      loadWards();
    }
  }, [form.role_id]);

  useEffect(() => {
    if (editingUser && constituencyList.length > 0) {
      const match = constituencyList.find(c => String(c.id) === String(editingUser.constituency_id));
      if (match) {
        setConstituencySearch(match.name);
      }
    }
  }, [constituencyList, editingUser]);

  useEffect(() => {
    if (form.ward_id && form.role_id === 'party_member') {
      loadBooths(parseInt(form.ward_id));
    } else {
      setBooths([]);
    }
  }, [form.ward_id, form.role_id]);

  const loadWards = async () => {
    try {
      const res = await constituencyAPI.getWards();
      setWards(res.data.data);
    } catch (err) { console.error(err); }
  };

  const loadBooths = async (wardId: number) => {
    try {
      const res = await constituencyAPI.getBooths(wardId);
      setBooths(res.data.data);
    } catch (err) { console.error(err); }
  };

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
    setForm({
      name: '', email: '', phone: '', password: '', role_id: '',
      constituency_id: '', ward_id: '', booth_id: '', status: 'active',
      address: '', qualification: '', profession: '', age: '', gender: '',
      support_preference: 'Neutral', photo_url: '',
    });
    setConstituencySearch('');
    setShowModal(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setForm({
      name: user.name, email: user.email, phone: user.phone || '', password: '',
      role_id: String(user.role_id), constituency_id: String(user.constituency_id || ''), ward_id: '', booth_id: '',
      status: user.status,
      address: '', qualification: '', profession: '', age: '', gender: '',
      support_preference: 'Neutral', photo_url: '',
    });
    const match = constituencyList.find(c => String(c.id) === String(user.constituency_id));
    setConstituencySearch(match ? match.name : '');
    setShowModal(true);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Only image files are allowed.');
      return;
    }

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isMlaRole && !form.constituency_id) {
        toast.error(t('users.constituency_required', 'Constituency assignment is required for MLA.'));
        return;
      }

      if (form.role_id === 'party_member') {
        const partyMemberData = {
          full_name: form.name,
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
        await partyMembersAPI.create(partyMemberData);
        toast.success(t('toast.success_save', 'Saved successfully'));
      } else {
        const data = {
          name: form.name,
          email: form.email,
          phone: form.phone,
          password: form.password,
          role_id: parseInt(form.role_id) || undefined,
          constituency_id: form.constituency_id ? parseInt(form.constituency_id) : undefined,
          ward_id: form.ward_id ? parseInt(form.ward_id) : undefined,
          booth_id: form.booth_id ? parseInt(form.booth_id) : undefined,
          status: form.status
        };
        if (editingUser) {
          await usersAPI.update(editingUser.id, data);
        } else {
          await usersAPI.create(data);
        }
      }
      setShowModal(false);
      loadUsers();
    } catch (err: any) {
      showToast.error(err.response?.data?.message || 'Error saving user');
    }
  };

  const handleDelete = async (id: number) => {
    showToast.confirm(
      t('users.delete_user', 'Delete User'),
      t('users.delete_confirm', 'Are you sure you want to delete this user account? This access will be immediately revoked.'),
      async () => {
        try {
          await usersAPI.delete(id);
          loadUsers();
          toast.success(t('users.deleted_success', 'User deleted successfully'));
        } catch (err: any) {
          showToast.error(t('users.delete_failed', 'Error deleting user'));
        }
      },
      t('action.delete', 'Delete')
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
            <h2 className="text-xl font-bold">{t('users.all_users', 'All Users')}</h2>
            <p className="text-sm text-dark-600 dark:text-dark-500 mt-1 font-medium">{t('users.total_users_count', '{total} users total').replace('{total}', String(meta.total))}</p>
          </div>
          <button onClick={openCreate} className="btn-primary">
            <UserPlus className="w-4 h-4" /> {t('users.add_user', 'Add User')}
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
              placeholder={t('users.search_placeholder', 'Search users by name, email, phone...')}
              className="form-input pl-10"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="form-input max-w-[180px]"
          >
            <option value="">{t('users.all_roles', 'All Roles')}</option>
            {roles.map(r => <option key={r.id} value={r.name}>{r.display_name}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="form-input max-w-[150px]"
          >
            <option value="">{t('users.all_status', 'All Status')}</option>
            <option value="active">{t('label.active', 'Active')}</option>
            <option value="inactive">{t('label.inactive', 'Inactive')}</option>
          </select>
        </div>

        {/* Table Container with Horizontal Scroll */}
        <div className="glass-card table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('label.user', 'User')}</th>
                <th>{t('label.role', 'Role')}</th>
                <th>{t('label.phone', 'Phone')}</th>
                <th>{t('label.constituency', 'Constituency')}</th>
                <th>{t('label.status', 'Status')}</th>
                <th>{t('users.last_login', 'Last Login')}</th>
                <th className="text-right">{t('label.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-saffron-400" />
                </td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-dark-500">{t('users.no_users_found', 'No users found')}</td></tr>
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
                    <td><span className="badge badge-primary">{t('role.' + user.role_name, user.role_display_name || user.role_name)}</span></td>
                    <td className="text-dark-700 dark:text-dark-400 font-medium">{user.phone || '—'}</td>
                    <td className="text-dark-700 dark:text-dark-400">{user.constituency_name || '—'}</td>
                    <td><span className={`badge ${getStatusBadge(user.status)}`}>{t('label.' + user.status, user.status)}</span></td>
                    <td className="text-dark-600 dark:text-dark-500 text-xs font-bold uppercase tracking-tighter">
                      {user.last_login ? new Date(user.last_login).toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-US') : t('label.never', 'Never')}
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
                className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${meta.page === i + 1
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
        title={editingUser ? t('users.edit_user', 'Edit User') : t('users.add_new_user', 'Add New User')}
        subtitle={editingUser ? t('users.modal_edit_sub', 'Update existing user account details') : t('users.modal_create_sub', 'Fill in the information below to create a new user account')}
        maxWidth="max-w-[700px]"
        footer={(
          <>
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary min-w-[120px]">{t('action.cancel', 'Cancel')}</button>
            <button type="submit" form="user-form" className="btn-primary min-w-[160px]">
              {editingUser ? t('action.save', 'Save Changes') : t('users.create_account', 'Create Account')}
            </button>
          </>
        )}
      >
        <form id="user-form" onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 col-span-2">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">{t('label.role', 'Role')} *</label>
              <select value={form.role_id} onChange={e => setForm({ ...form, role_id: e.target.value })} className="form-input" required>
                <option value="">{t('users.select_role', 'Select a role')}</option>
                {roles.map(r => <option key={r.id} value={r.id}>{t('role.' + r.name, r.display_name)}</option>)}
                <option value="party_member">{t('users.party_member', 'Party Member')}</option>
              </select>
            </div>
          </div>

          {form.role_id === 'party_member' ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">{t('label.full_name', 'Full Name')} *</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="form-input" placeholder="e.g. Rahul Kumar" required />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">{t('users.phone_number_label', 'Phone Number *')}</label>
                  <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="form-input" placeholder="+91 0000000000" required />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">{t('users.email_optional', 'Email (Optional)')}</label>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="form-input" placeholder="john@example.com" />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">{t('label.address', 'Address')}</label>
                  <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="form-input" placeholder="Enter home address" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">{t('users.ward_number_label', 'Ward Number *')}</label>
                  <select value={form.ward_id} onChange={e => setForm({ ...form, ward_id: e.target.value, booth_id: '' })} className="form-input" required>
                    <option value="">{t('users.select_ward', 'Select Ward')}</option>
                    {wards.map(w => <option key={w.id} value={w.id}>{t('label.ward', 'Ward')} {w.number} - {w.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">{t('users.booth_number_optional', 'Booth Number (Optional)')}</label>
                  <select value={form.booth_id} onChange={e => setForm({ ...form, booth_id: e.target.value })} className="form-input" disabled={!form.ward_id}>
                    <option value="">{t('users.select_booth', 'Select Booth')}</option>
                    {booths.map(b => <option key={b.id} value={b.id}>{t('label.booth', 'Booth')} {b.number} - {b.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">{t('users.qualification_details', 'Qualification Details')}</label>
                  <input value={form.qualification} onChange={e => setForm({ ...form, qualification: e.target.value })} className="form-input" placeholder="e.g. Graduate" />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">{t('users.profession_occupation', 'Profession / Occupation')}</label>
                  <input value={form.profession} onChange={e => setForm({ ...form, profession: e.target.value })} className="form-input" placeholder="e.g. Businessman" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">{t('label.age', 'Age')}</label>
                  <input type="number" value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} className="form-input" placeholder="e.g. 35" />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">{t('label.gender', 'Gender')}</label>
                  <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })} className="form-input">
                    <option value="">{t('voters.select_gender', 'Select Gender')}</option>
                    <option value="male">{t('gender.male', 'Male')}</option>
                    <option value="female">{t('gender.female', 'Female')}</option>
                    <option value="other">{t('gender.other', 'Other')}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">{t('users.support_preference', 'Support Preference')}</label>
                  <select value={form.support_preference} onChange={e => setForm({ ...form, support_preference: e.target.value })} className="form-input">
                    <option value="Neutral">{t('support.neutral', 'Neutral')}</option>
                    <option value="BJP">BJP</option>
                    <option value="Samajwadi Party">Samajwadi Party</option>
                    <option value="Congress">Congress</option>
                    <option value="BSP">BSP</option>
                    <option value="AAP">AAP</option>
                    <option value="Undecided">{t('label.unknown', 'Undecided')}</option>
                    <option value="Other">{t('label.other', 'Other')}</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">{t('users.photo_upload', 'Photo Upload')}</label>
                <div className="flex items-center gap-4">
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} className="form-input" />
                  {form.photo_url && (
                    <div className="relative w-16 h-16 rounded-xl border border-dark-200 dark:border-white/10 overflow-hidden flex-shrink-0">
                      <img src={form.photo_url} className="w-full h-full object-cover" />
                      <button type="button" onClick={() => setForm(prev => ({ ...prev, photo_url: '' }))} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 hover:scale-110 transition-transform">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">{t('label.full_name', 'Full Name')} *</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="form-input" placeholder="e.g. John Doe" required />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">{t('label.email', 'Email')} *</label>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="form-input" placeholder="john@example.com" required />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">{t('label.phone', 'Phone')}</label>
                  <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="form-input" placeholder="+91 0000000000" />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">{editingUser ? t('users.new_password', 'New Password') : (t('label.password', 'Password') + ' *')}</label>
                  <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="form-input" placeholder="••••••••" required={!editingUser} />
                </div>
              </div>

              {isMlaRole && (
                <div className="space-y-2 col-span-2 relative">
                  <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">{t('label.constituency', 'Constituency')} *</label>
                  <div className="relative">
                    <input
                      type="text"
                      className="form-input pr-10"
                      placeholder={t('users.search_constituency', 'Search & select constituency...')}
                      value={constituencySearch}
                      onChange={(e) => {
                        setConstituencySearch(e.target.value);
                        setShowConstDropdown(true);
                        const match = constituencyList.find(c => c.name.toLowerCase() === e.target.value.toLowerCase());
                        setForm(prev => ({ ...prev, constituency_id: match ? String(match.id) : '' }));
                      }}
                      onFocus={() => setShowConstDropdown(true)}
                      required
                    />
                    <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500 pointer-events-none" />
                  </div>
                  {showConstDropdown && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowConstDropdown(false)} />
                      <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-xl border border-dark-200/50 dark:border-white/10 bg-white/95 dark:bg-dark-950/95 backdrop-blur-md shadow-2xl z-20 custom-scrollbar py-1">
                        {constituencyList.filter(c => c.name.toLowerCase().includes(constituencySearch.toLowerCase())).length === 0 ? (
                          <div className="px-4 py-2.5 text-xs text-dark-500 text-center font-medium">
                            {t('users.no_constituencies_found', 'No constituencies found')}
                          </div>
                        ) : (
                          constituencyList.filter(c => c.name.toLowerCase().includes(constituencySearch.toLowerCase())).map(c => (
                            <button
                              key={c.id}
                              type="button"
                              className={`w-full text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors flex items-center justify-between ${
                                String(form.constituency_id) === String(c.id)
                                  ? 'bg-saffron-500/10 text-saffron-500 dark:bg-saffron-500/20'
                                  : 'text-dark-800 dark:text-dark-200 hover:bg-dark-100 dark:hover:bg-white/5'
                              }`}
                              onClick={() => {
                                setForm(prev => ({ ...prev, constituency_id: String(c.id) }));
                                setConstituencySearch(c.name);
                                setShowConstDropdown(false);
                              }}
                            >
                              <span>{c.name}</span>
                              <span className="text-[9px] opacity-60 font-bold bg-dark-100 dark:bg-white/5 px-2 py-0.5 rounded">
                                {c.district_name || c.state_name}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 col-span-2">
                  <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">{t('users.account_status', 'Account Status')}</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="form-input">
                    <option value="active">{t('label.active', 'Active')}</option>
                    <option value="inactive">{t('label.inactive', 'Inactive')}</option>
                  </select>
                </div>
              </div>
            </>
          )}
        </form>
      </Modal>

      <DetailsModal
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title={t('users.details_title', 'User Details')}
        subtitle={t('users.details_subtitle', 'Identity, access role, and geography mapping')}
        items={[
          { label: t('label.name', 'Name'), value: selectedUser?.name },
          { label: t('label.role', 'Role'), value: selectedUser?.role_name ? t('role.' + selectedUser.role_name, selectedUser.role_display_name || selectedUser.role_name) : '—' },
          { label: t('users.designation', 'Designation'), value: selectedUser?.role_name ? t('role.' + selectedUser.role_name, selectedUser.role_display_name || selectedUser.role_name) : '—' },
          { label: t('voters.assigned_leader', 'Assigned Leader'), value: '—' },
          { label: t('label.ward', 'Ward'), value: selectedUser?.ward_name || '—' },
          { label: t('label.booth', 'Booth'), value: selectedUser?.booth_name || '—' },
          { label: t('label.constituency', 'Constituency'), value: selectedUser?.constituency_name || '—' },
          { label: t('label.area', 'Area'), value: selectedUser?.area_name || '—' },
          { label: t('label.phone', 'Phone'), value: selectedUser?.phone || '—' },
          { label: t('label.email', 'Email'), value: selectedUser?.email || '—' },
          { label: t('label.status', 'Status'), value: selectedUser?.status ? t('label.' + selectedUser.status, selectedUser.status) : '—' },
          { label: t('users.last_login', 'Last Login'), value: selectedUser?.last_login ? new Date(selectedUser.last_login).toLocaleString(language === 'hi' ? 'hi-IN' : 'en-US') : t('label.never', 'Never') },
          { label: t('label.date', 'Created At'), value: selectedUser?.created_at ? new Date(selectedUser.created_at).toLocaleString(language === 'hi' ? 'hi-IN' : 'en-US') : '—' },
        ]}
      />
    </>
  );
}
