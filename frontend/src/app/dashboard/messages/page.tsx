'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { messagesAPI } from '@/lib/api';
import { Message } from '@/types';
import { Plus, X, Loader2, MessageSquare, Send, Mail, MailOpen } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Modal from '@/components/Modal';

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inbox, setInbox] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [view, setView] = useState<'sent' | 'inbox'>('sent');
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    title: '', content: '', target_type: 'all', channel: 'push',
  });

  useEffect(() => { loadMessages(); loadInbox(); }, []);

  const loadMessages = async () => {
    setLoading(true);
    try { const res = await messagesAPI.getAll(); setMessages(res.data.data); setMeta(res.data.meta); }
    catch {} finally { setLoading(false); }
  };

  const loadInbox = async () => {
    try { const res = await messagesAPI.getInbox(); setInbox(res.data.data); } catch {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await messagesAPI.send(form);
      setShowModal(false);
      loadMessages();
      setForm({ title: '', content: '', target_type: 'all', channel: 'push' });
    } catch (err: any) { alert(err.response?.data?.message || 'Error'); }
  };

  const markRead = async (id: number) => {
    try { await messagesAPI.markAsRead(id); loadInbox(); } catch {}
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this message?')) return;
    try { await messagesAPI.delete(id); loadMessages(); } catch {}
  };

  const currentList = view === 'sent' ? messages : inbox;

  return (
    <>
      <Header title="Messages" subtitle="Communication center" />
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="tabs-toggle">
            <button onClick={() => setView('sent')} className={`tabs-toggle-item ${view === 'sent' ? 'tabs-toggle-item-active' : 'tabs-toggle-item-inactive'}`}>
              <Send className="w-4 h-4" />Sent ({meta.total})
            </button>
            <button onClick={() => setView('inbox')} className={`tabs-toggle-item ${view === 'inbox' ? 'tabs-toggle-item-active' : 'tabs-toggle-item-inactive'}`}>
              <Mail className="w-4 h-4" />Inbox ({inbox.length})
            </button>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary"><MessageSquare className="w-4 h-4" /> New Message</button>
        </div>

        {/* Messages List */}
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-saffron-400" /></div>
        ) : currentList.length === 0 ? (
          <div className="text-center py-16 glass-card">
            <MessageSquare className="w-12 h-12 text-dark-700 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-dark-300">No messages</h3>
          </div>
        ) : (
          <div className="space-y-3">
            {currentList.map((msg: any) => (
              <div key={msg.id} className="glass-card-hover p-5 border border-white/[0.03]">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${msg.read_at ? 'bg-dark-800 text-dark-500' : 'bg-saffron-500/12 text-saffron-400'}`}>
                    {msg.read_at ? <MailOpen className="w-5 h-5" /> : <Mail className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h4 className="font-bold text-dark-900 dark:text-dark-100 group-hover:text-saffron-600 transition-colors uppercase tracking-tight">{msg.title}</h4>
                      <span className="badge badge-neutral text-[10px]">{msg.target_type || msg.channel}</span>
                    </div>
                    <p className="text-sm text-dark-700 dark:text-dark-400 line-clamp-2 mb-2 leading-relaxed">{msg.content}</p>
                    <div className="flex items-center gap-4 text-[11px] font-bold uppercase tracking-wider text-dark-600 dark:text-dark-500">
                      {msg.sender_name && <span className="flex items-center gap-1">👤 {msg.sender_name}</span>}
                      {msg.recipient_count && <span className="flex items-center gap-1">👥 {msg.recipient_count}</span>}
                      <span>{formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {view === 'inbox' && !msg.read_at && (
                      <button onClick={() => markRead(msg.id)} className="btn-sm btn-secondary">Mark Read</button>
                    )}
                    {view === 'sent' && (
                      <button onClick={() => handleDelete(msg.id)} className="btn-icon bg-red-500/10 border border-red-500/20 text-red-400"><X className="w-3.5 h-3.5" /></button>
                    )}
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
        title="Send New Message"
        subtitle="Broadcast tactical updates to your field teams"
        maxWidth="max-w-[650px]"
        footer={(
          <>
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary min-w-[120px]">Cancel</button>
            <button type="submit" form="message-form" className="btn-primary min-w-[160px]" disabled={submitting}>
              {submitting ? 'Sending...' : 'Send Message'}
            </button>
          </>
        )}
      >
        <form id="message-form" onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Message Title *</label>
            <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="form-input" placeholder="e.g. Critical Update: Ward 5" required />
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Message Content *</label>
            <textarea value={form.content} onChange={e => setForm({...form, content: e.target.value})} className="form-input h-32 resize-none" placeholder="Enter your strategic message here..." required />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Target Audience</label>
              <select value={form.target_type} onChange={e => setForm({...form, target_type: e.target.value})} className="form-input">
                <option value="all">All Users</option>
                <option value="booth">Booth Specific</option>
                <option value="ward">Ward Specific</option>
                <option value="constituency">Constituency Specific</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">Priority Channel</label>
              <select value={form.channel} onChange={e => setForm({...form, channel: e.target.value})} className="form-input">
                <option value="push">Push Notification</option>
                <option value="sms">High Priority SMS</option>
                <option value="whatsapp">WhatsApp Direct</option>
              </select>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
