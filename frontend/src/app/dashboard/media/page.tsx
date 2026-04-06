'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Header from '@/components/Header';
import { mediaAPI } from '@/lib/api';
import { Plus, X, Loader2, Image as ImageIcon, Film, FileText, Download, Trash2 } from 'lucide-react';
import Modal from '@/components/Modal';

export default function MediaPage() {
  const [media, setMedia] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });

  const [form, setForm] = useState({ title: '', file_url: '', file_type: 'image', category: '' });

  const loadMedia = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {};
      if (typeFilter) params.file_type = typeFilter;
      const res = await mediaAPI.getAll(params);
      setMedia(res.data.data);
      setMeta(res.data.meta);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { loadMedia(); }, [typeFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await mediaAPI.create(form);
      setShowModal(false);
      loadMedia();
    } catch (err: any) { alert(err.response?.data?.message || 'Error'); }
  };

  const handleDownload = async (id: number) => {
    try { await mediaAPI.trackDownload(id); } catch {}
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this media?')) return;
    try { await mediaAPI.delete(id); loadMedia(); } catch {}
  };

  const typeIcon = (type: string) => {
    switch(type) {
      case 'image': return <ImageIcon className="w-6 h-6" />;
      case 'video': return <Film className="w-6 h-6" />;
      default: return <FileText className="w-6 h-6" />;
    }
  };

  const typeColor = (type: string) => {
    switch(type) {
      case 'image': return 'bg-blue-500/12 text-blue-400';
      case 'video': return 'bg-purple-500/12 text-purple-400';
      default: return 'bg-green-500/12 text-green-400';
    }
  };

  return (
    <>
      <Header title="Media Library" subtitle="Campaign media assets and documents" />
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-3">
            {['', 'image', 'video', 'pdf'].map(t => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={`filter-tab ${typeFilter === t ? 'filter-tab-active' : 'filter-tab-inactive'}`}>
                {t ? typeIcon(t) : null}
                {t ? t : 'All'}
              </button>
            ))}
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary"><Plus className="w-4 h-4" /> Add Media</button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-saffron-400" /></div>
        ) : media.length === 0 ? (
          <div className="text-center py-16 glass-card">
            <ImageIcon className="w-12 h-12 text-dark-700 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-dark-300">No media found</h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {media.map((item: any) => (
              <div key={item.id} className="glass-card-hover overflow-hidden group">
                {/* Preview area */}
                <div className="h-40 bg-dark-800/40 flex items-center justify-center relative">
                  {item.file_type === 'image' && item.file_url ? (
                    <Image 
                      src={item.file_url} 
                      alt={item.title} 
                      fill 
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-cover" 
                    />
                  ) : (
                    <div className={`w-16 h-16 rounded-lg flex items-center justify-center ${typeColor(item.file_type)}`}>
                      {typeIcon(item.file_type)}
                    </div>
                  )}
                  <span className={`absolute top-3 right-3 badge ${item.file_type === 'image' ? 'badge-info' : item.file_type === 'video' ? 'badge-primary' : 'badge-success'} text-[10px]`}>
                    {item.file_type}
                  </span>
                </div>
                {/* Info */}
                <div className="p-4">
                  <h3 className="font-bold text-dark-900 dark:text-dark-100 truncate group-hover:text-saffron-600 transition-colors">{item.title || 'Untitled'}</h3>
                  <div className="flex items-center justify-between mt-2 text-[11px] font-bold uppercase tracking-wider text-dark-600 dark:text-dark-500">
                    <span className="flex items-center gap-1">👤 {item.uploaded_by_name}</span>
                    <span className="flex items-center gap-1">📊 {item.download_count || 0} hits</span>
                  </div>
                  <div className="flex gap-2 mt-3 pt-3 border-t border-white/5">
                    <a href={item.file_url} target="_blank" rel="noopener" onClick={() => handleDownload(item.id)}
                      className="btn-secondary btn-sm flex-1 text-center"><Download className="w-3 h-3" /> Open</a>
                    <button onClick={() => handleDelete(item.id)}
                      className="btn-icon btn-sm bg-red-500/10 border border-red-500/20 text-red-400"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Add Strategic Media"
        subtitle="Upload and manage tactical campaign assets"
        maxWidth="max-w-[650px]"
        footer={(
          <>
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary min-w-[120px]">Cancel</button>
            <button type="submit" form="media-form" className="btn-primary min-w-[160px]">
              Add to Library
            </button>
          </>
        )}
      >
        <form id="media-form" onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Media Title</label>
            <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="form-input" placeholder="e.g. Campaign Poster V1" />
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Source File URL *</label>
            <input value={form.file_url} onChange={e => setForm({...form, file_url: e.target.value})} className="form-input" placeholder="https://..." required />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Media Category</label>
              <select value={form.file_type} onChange={e => setForm({...form, file_type: e.target.value})} className="form-input">
                <option value="image">Strategic Image</option>
                <option value="video">Tactical Video</option>
                <option value="pdf">Document / PDF</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Campaign Tag</label>
              <input value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="form-input" placeholder="e.g. Rally, Digital" />
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
