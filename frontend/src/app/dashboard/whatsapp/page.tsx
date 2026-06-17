'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { MODULE_HEADER } from '@/lib/ui-labels';
import Header from '@/components/Header';
import {
  MessageSquare, Send, Users, CheckCircle, AlertTriangle,
  Clock, Plus, Trash2, Search, Filter, Smile, HelpCircle,
  TrendingUp, CheckSquare, Square, ChevronRight, Eye, RefreshCw
} from 'lucide-react';
import { whatsappAPI, constituencyAPI } from '@/lib/api';
import { socketService } from '@/lib/socket';
import toast from 'react-hot-toast';

interface Recipient {
  id: number;
  name: string;
  phone: string;
  type: 'voter' | 'party_member' | 'worker';
  constituency_name: string;
  ward_name: string;
  booth_name: string;
  constituency_id: number;
  ward_id: number;
  booth_id: number;
}

interface Template {
  id: number;
  name: string;
  category: string;
  language: string;
  body_text: string;
  status: string;
}

interface Campaign {
  id: number;
  name: string;
  sender_name: string;
  template_name: string | null;
  message_text: string | null;
  recipient_count: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
  created_at: string;
}

interface CampaignMessage {
  id: number;
  recipient_name: string;
  recipient_phone: string;
  message_text: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  error_message: string | null;
  created_at: string;
}

interface Analytics {
  total_campaigns: number;
  total_messages: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
  delivered_rate: number;
  read_rate: number;
  failed_rate: number;
  time_series: Array<{ date: string; count: number; read_count: number }>;
}

const EMOJIS = ['😊', '🙏', '📢', '🗳️', '🇮🇳', '👍', '🤝', '👋', '🗓️', '📍', '⭐', '✨'];

export default function WhatsAppPage() {
  const { user } = useAuth();
  const { t } = useLanguage();

  // Tabs
  const [activeTab, setActiveTab] = useState<'analytics' | 'compose' | 'history' | 'templates' | 'settings'>('analytics');
  const [provider, setProvider] = useState<'meta' | 'rest'>('meta');

  // Core Data State
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  // Settings Form State
  const [accessToken, setAccessToken] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [businessAccountId, setBusinessAccountId] = useState('');
  const [webhookVerifyToken, setWebhookVerifyToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [showVerifyToken, setShowVerifyToken] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');

  // Filters for Recipient Selector
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'voters' | 'party_members' | 'workers'>('all');
  const [constituencyFilter, setConstituencyFilter] = useState<number | ''>('');
  const [wardFilter, setWardFilter] = useState<number | ''>('');
  const [boothFilter, setBoothFilter] = useState<number | ''>('');

  // Dropdown Lists
  const [constituencies, setConstituencies] = useState<any[]>([]);
  const [wards, setWards] = useState<any[]>([]);
  const [booths, setBooths] = useState<any[]>([]);

  // Composer Form State
  const [campaignName, setCampaignName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [customMessage, setCustomMessage] = useState('');
  const [eventDetails, setEventDetails] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState<Recipient[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Loading States
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [sending, setSending] = useState(false);

  // Modal State (Campaign Messages Details)
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [campaignMessages, setCampaignMessages] = useState<CampaignMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Template Creator State
  const [showNewTemplateModal, setShowNewTemplateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateCategory, setNewTemplateCategory] = useState('utility');
  const [newTemplateLanguage, setNewTemplateLanguage] = useState('en');
  const [newTemplateBody, setNewTemplateBody] = useState('');
  const [creatingTemplate, setCreatingTemplate] = useState(false);

  // Auto-refresh fallback polling
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeTab === 'analytics' || activeTab === 'history' || showDetailsModal) {
      interval = setInterval(() => {
        if (activeTab === 'analytics') fetchAnalytics(false);
        if (activeTab === 'history') fetchCampaigns(false);
        if (showDetailsModal && selectedCampaign) fetchCampaignMessages(selectedCampaign.id, false);
      }, 10000);
    }
    return () => clearInterval(interval);
  }, [activeTab, showDetailsModal, selectedCampaign]);

  // Initial loads
  useEffect(() => {
    fetchTemplates();
    fetchAnalytics(true);
    fetchCampaigns(true);
    loadConstituencyHierarchy();
    if (user?.role_name === 'super_admin') {
      fetchSettings();
    }
    if (typeof window !== 'undefined') {
      setWebhookUrl(`${window.location.origin.replace(':3000', ':5000')}/api/whatsapp/webhook`);
    }
  }, [user]);

  // Listen for real-time status updates via Socket.io
  useEffect(() => {
    const socket = socketService.getSocket();
    if (socket) {
      const handleStatusUpdate = (update: { campaignId: number; messageId: number; status: string; error_message: string | null }) => {
        fetchCampaigns(false);
        fetchAnalytics(false);
        if (showDetailsModal && selectedCampaign?.id === update.campaignId) {
          fetchCampaignMessages(update.campaignId, false);
        }
      };

      socket.on('whatsapp:status_update', handleStatusUpdate);
      return () => {
        socket.off('whatsapp:status_update', handleStatusUpdate);
      };
    }
  }, [showDetailsModal, selectedCampaign]);

  // Load constituencies
  const loadConstituencyHierarchy = async () => {
    try {
      if (user?.role_name === 'super_admin') {
        const res = await constituencyAPI.getConstituencies();
        setConstituencies(res.data.data || []);
      } else if (user?.constituency_id) {
        setConstituencyFilter(user.constituency_id);
        fetchWards(user.constituency_id);
      }
    } catch (err) {
      console.error('Error loading constituency hierarchy:', err);
    }
  };

  // Fetch Wards based on constituency
  const fetchWards = async (constId: number) => {
    try {
      const res = await constituencyAPI.getWards(constId);
      setWards(res.data.data || []);
      setWards((prev) => prev.sort((a, b) => a.name.localeCompare(b.name)));
      setWardFilter('');
      setBoothFilter('');
      setBooths([]);
    } catch (err) {
      console.error('Error loading Wards:', err);
    }
  };

  // Fetch Booths based on ward
  const fetchBooths = async (wardId: number) => {
    try {
      const res = await constituencyAPI.getBooths(wardId);
      setBooths(res.data.data || []);
      setBoothFilter('');
    } catch (err) {
      console.error('Error loading Booths:', err);
    }
  };

  // Handle Constituency Dropdown Change
  const handleConstituencyChange = (id: string) => {
    if (id === '') {
      setConstituencyFilter('');
      setWards([]);
      setBooths([]);
      setWardFilter('');
      setBoothFilter('');
    } else {
      const numericId = parseInt(id);
      setConstituencyFilter(numericId);
      fetchWards(numericId);
    }
  };

  // Handle Ward Dropdown Change
  const handleWardChange = (id: string) => {
    if (id === '') {
      setWardFilter('');
      setBooths([]);
      setBoothFilter('');
    } else {
      const numericId = parseInt(id);
      setWardFilter(numericId);
      fetchBooths(numericId);
    }
  };

  // Load Recipients based on current filters
  const fetchRecipients = async () => {
    setLoadingRecipients(true);
    try {
      const params: any = {};
      if (searchTerm) params.search = searchTerm;
      if (typeFilter !== 'all') params.type = typeFilter;
      if (constituencyFilter) params.constituency_id = constituencyFilter;
      if (wardFilter) params.ward_id = wardFilter;
      if (boothFilter) params.booth_id = boothFilter;

      const res = await whatsappAPI.getRecipients(params);
      setRecipients(res.data.data || []);
    } catch (err) {
      console.error('Error fetching recipients:', err);
      toast.error('Failed to load recipients list.');
    } finally {
      setLoadingRecipients(false);
    }
  };

  // Trigger search on filter changes
  useEffect(() => {
    if (activeTab === 'compose') {
      fetchRecipients();
    }
  }, [searchTerm, typeFilter, constituencyFilter, wardFilter, boothFilter, activeTab]);

  // Fetch Templates
  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res = await whatsappAPI.getTemplates();
      setTemplates(res.data.data || []);
    } catch (err) {
      console.error('Error loading templates:', err);
    } finally {
      setLoadingTemplates(false);
    }
  };

  // Fetch Campaigns
  const fetchCampaigns = async (showLoading = true) => {
    if (showLoading) setLoadingCampaigns(true);
    try {
      const res = await whatsappAPI.getCampaigns();
      setCampaigns(res.data.data || []);
    } catch (err) {
      console.error('Error loading campaigns:', err);
    } finally {
      if (showLoading) setLoadingCampaigns(false);
    }
  };

  // Fetch Analytics
  const fetchAnalytics = async (showLoading = true) => {
    if (showLoading) setLoadingAnalytics(true);
    try {
      const res = await whatsappAPI.getAnalytics();
      setAnalytics(res.data.data);
    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      if (showLoading) setLoadingAnalytics(false);
    }
  };

  // Fetch Campaign individual messages
  const fetchCampaignMessages = async (campaignId: number, showLoading = true) => {
    if (showLoading) setLoadingMessages(true);
    try {
      const res = await whatsappAPI.getCampaignMessages(campaignId);
      setCampaignMessages(res.data.data || []);
    } catch (err) {
      console.error('Error loading campaign messages:', err);
    } finally {
      if (showLoading) setLoadingMessages(false);
    }
  };

  // Handle Recipient selection toggles
  const handleToggleRecipient = (rec: Recipient) => {
    if (selectedRecipients.some((r) => r.id === rec.id && r.type === rec.type)) {
      setSelectedRecipients(selectedRecipients.filter((r) => !(r.id === rec.id && r.type === rec.type)));
    } else {
      setSelectedRecipients([...selectedRecipients, rec]);
    }
  };

  // Handle Select All visible recipients
  const handleSelectAll = () => {
    const allSelected = recipients.every((r) =>
      selectedRecipients.some((sr) => sr.id === r.id && sr.type === r.type)
    );

    if (allSelected) {
      // De-select all visible ones
      const visibleIds = recipients.map((r) => `${r.type}_${r.id}`);
      setSelectedRecipients(selectedRecipients.filter((sr) => !visibleIds.includes(`${sr.type}_${sr.id}`)));
    } else {
      // Add missing visible ones
      const toAdd = recipients.filter(
        (r) => !selectedRecipients.some((sr) => sr.id === r.id && sr.type === r.type)
      );
      setSelectedRecipients([...selectedRecipients, ...toAdd]);
    }
  };

  // Insert emojis into message text
  const handleInsertEmoji = (emoji: string) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const text = customMessage || selectedTemplate?.body_text || '';
    const newText = text.substring(0, start) + emoji + text.substring(end);

    if (selectedTemplate) {
      setSelectedTemplate({ ...selectedTemplate, body_text: newText });
    } else {
      setCustomMessage(newText);
    }
    setShowEmojiPicker(false);
  };

  // Insert variable placeholders
  const handleInsertPlaceholder = (placeholder: string) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const text = selectedTemplate ? selectedTemplate.body_text : customMessage;
    const newText = text.substring(0, start) + `{{${placeholder}}}` + text.substring(end);

    if (selectedTemplate) {
      setSelectedTemplate({ ...selectedTemplate, body_text: newText });
    } else {
      setCustomMessage(newText);
    }
  };

  // Message preview text rendering
  const getMessagePreview = () => {
    const rawText = selectedTemplate ? selectedTemplate.body_text : customMessage;
    if (!rawText) return 'Message preview will appear here...';

    // Mock first selected recipient or general placeholders
    const sampleRec = selectedRecipients[0] || {
      name: 'Satyam Pandey',
      ward_name: 'Ward 1 - Aminabad',
      booth_name: 'Booth 2',
      constituency_name: 'Lucknow Central'
    };

    return rawText
      .replace(/{{Name}}/g, sampleRec.name)
      .replace(/{{Ward}}/g, sampleRec.ward_name || 'Ward 1')
      .replace(/{{Booth}}/g, sampleRec.booth_name || 'Booth 2')
      .replace(/{{Constituency}}/g, sampleRec.constituency_name || 'Lucknow Central')
      .replace(/{{Event}}/g, eventDetails || 'Public Meeting Invitation');
  };

  // Submit and send WhatsApp Campaign
  const handleSendCampaign = async () => {
    if (selectedRecipients.length === 0) {
      toast.error(t('whatsapp.no_recipients', 'Please select at least one recipient.'));
      return;
    }

    setSending(true);
    try {
      const payload = {
        campaign_name: campaignName,
        recipients: selectedRecipients,
        template_name: selectedTemplate ? selectedTemplate.name : null,
        message_text: selectedTemplate ? null : customMessage,
        event_details: eventDetails
      };

      await whatsappAPI.send(payload);
      toast.success(t('whatsapp.success_sent', 'WhatsApp campaign initiated successfully!'));

      // Reset composer
      setCampaignName('');
      setSelectedTemplate(null);
      setCustomMessage('');
      setEventDetails('');
      setSelectedRecipients([]);

      // Refresh statistics and history
      fetchAnalytics(true);
      fetchCampaigns(true);

      // Navigate back to analytics dashboard
      setActiveTab('analytics');
    } catch (err: any) {
      console.error('Error sending campaign:', err);
      toast.error(err.response?.data?.message || t('whatsapp.error_sent', 'Failed to send WhatsApp campaign.'));
    } finally {
      setSending(false);
    }
  };

  // View campaign details modal
  const handleViewCampaignDetails = async (camp: Campaign) => {
    setSelectedCampaign(camp);
    setShowDetailsModal(true);
    await fetchCampaignMessages(camp.id, true);
  };

  // Submit and create new WhatsApp Template
  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateName || !newTemplateBody) {
      toast.error('Template name and body text are required.');
      return;
    }

    setCreatingTemplate(true);
    try {
      await whatsappAPI.createTemplate({
        name: newTemplateName,
        category: newTemplateCategory,
        language: newTemplateLanguage,
        body_text: newTemplateBody
      });
      toast.success(t('whatsapp.success_template', 'Template created successfully.'));

      // Reset creator states
      setNewTemplateName('');
      setNewTemplateBody('');
      setShowNewTemplateModal(false);

      // Refresh templates
      fetchTemplates();
    } catch (err: any) {
      console.error('Error creating template:', err);
      toast.error(err.response?.data?.message || t('whatsapp.error_template', 'Failed to create template.'));
    } finally {
      setCreatingTemplate(false);
    }
  };

  // Delete message template
  const handleDeleteTemplate = async (id: number) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      await whatsappAPI.deleteTemplate(id);
      toast.success('Template deleted successfully.');
      fetchTemplates();
    } catch (err) {
      console.error('Error deleting template:', err);
      toast.error('Failed to delete template.');
    }
  };

  // Fetch WhatsApp settings
  const fetchSettings = async () => {
    setLoadingSettings(true);
    try {
      const res = await whatsappAPI.getSettings();
      if (res.data.success && res.data.data) {
        setAccessToken(res.data.data.access_token || '');
        setPhoneNumberId(res.data.data.phone_number_id || '');
        setBusinessAccountId(res.data.data.business_account_id || '');
        setWebhookVerifyToken(res.data.data.webhook_verify_token || '');
        if (res.data.data.webhook_verify_token === 'rest' || (res.data.data.business_account_id && res.data.data.business_account_id.startsWith('http'))) {
          setProvider('rest');
        } else {
          setProvider('meta');
        }
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    } finally {
      setLoadingSettings(false);
    }
  };

  // Save WhatsApp settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const tokenToSave = provider === 'rest' ? 'rest' : webhookVerifyToken;
    if (!accessToken || !phoneNumberId || !businessAccountId || !tokenToSave) {
      toast.error('All settings fields are required.');
      return;
    }

    setSavingSettings(true);
    try {
      await whatsappAPI.saveSettings({
        access_token: accessToken,
        phone_number_id: phoneNumberId,
        business_account_id: businessAccountId,
        webhook_verify_token: tokenToSave
      });
      toast.success(provider === 'rest' ? 'WhatsApp REST API credentials saved successfully.' : 'WhatsApp Business Cloud API settings saved successfully.');
    } catch (err: any) {
      console.error('Error saving settings:', err);
      toast.error(err.response?.data?.message || 'Failed to save settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  // Get status color mappings
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'read':
        return <span className="px-2 py-0.5 text-xs font-bold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 rounded-full flex items-center gap-1 w-max"><CheckCircle className="w-3.5 h-3.5" /> Read</span>;
      case 'delivered':
        return <span className="px-2 py-0.5 text-xs font-bold bg-sky-100 dark:bg-sky-950/40 text-sky-600 rounded-full flex items-center gap-1 w-max"><CheckCircle className="w-3.5 h-3.5" /> Delivered</span>;
      case 'failed':
        return <span className="px-2 py-0.5 text-xs font-bold bg-rose-100 dark:bg-rose-950/40 text-rose-600 rounded-full flex items-center gap-1 w-max"><AlertTriangle className="w-3.5 h-3.5" /> Failed</span>;
      case 'pending':
        return <span className="px-2 py-0.5 text-xs font-bold bg-amber-100 dark:bg-amber-950/40 text-amber-600 rounded-full flex items-center gap-1 w-max"><Clock className="w-3.5 h-3.5" /> Pending</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-bold bg-slate-100 dark:bg-slate-900 text-slate-500 rounded-full flex items-center gap-1 w-max"><Clock className="w-3.5 h-3.5" /> Sent</span>;
    }
  };

  const header = MODULE_HEADER.whatsapp;

  return (
    <>
      <Header title={header.title} subtitle={header.subtitle} />
      <div className="p-8 space-y-6">

        {/* Navigation Tabs */}
        <div className="flex border-b border-dark-100 dark:border-white/5 mb-6">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-6 py-3 text-sm font-semibold transition-all border-b-2 -mb-[2px] ${activeTab === 'analytics'
              ? 'border-saffron-500 text-saffron-500 font-bold'
              : 'border-transparent text-dark-500 hover:text-dark-700 dark:hover:text-dark-300'
              }`}
          >
            {t('whatsapp.analytics', 'Analytics')}
          </button>
          <button
            onClick={() => setActiveTab('compose')}
            className={`px-6 py-3 text-sm font-semibold transition-all border-b-2 -mb-[2px] ${activeTab === 'compose'
              ? 'border-saffron-500 text-saffron-500 font-bold'
              : 'border-transparent text-dark-500 hover:text-dark-700 dark:hover:text-dark-300'
              }`}
          >
            {t('whatsapp.new_campaign', 'New Campaign')}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-3 text-sm font-semibold transition-all border-b-2 -mb-[2px] ${activeTab === 'history'
              ? 'border-saffron-500 text-saffron-500 font-bold'
              : 'border-transparent text-dark-500 hover:text-dark-700 dark:hover:text-dark-300'
              }`}
          >
            {t('whatsapp.history', 'History')}
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-6 py-3 text-sm font-semibold transition-all border-b-2 -mb-[2px] ${activeTab === 'templates'
              ? 'border-saffron-500 text-saffron-500 font-bold'
              : 'border-transparent text-dark-500 hover:text-dark-700 dark:hover:text-dark-300'
              }`}
          >
            {t('whatsapp.templates', 'Templates')}
          </button>
          {/* Settings tab removed */}
        </div>

        {/* ─── TAB 1: ANALYTICS OVERVIEW ─── */}
        {activeTab === 'analytics' && (
          <div className="space-y-6 animate-fade-in">
            {loadingAnalytics && !analytics ? (
              <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 text-saffron-500 animate-spin" />
              </div>
            ) : (
              <>
                {/* Analytics Metric Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">

                  <div className="bg-white dark:bg-dark-900/50 p-5 rounded-2xl border border-dark-200/50 dark:border-white/[0.04] relative overflow-hidden group hover:border-saffron-500/30 transition-all duration-300">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-saffron-500/[0.02] rounded-bl-full pointer-events-none" />
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wide">{t('whatsapp.total_campaigns', 'Total Campaigns')}</p>
                      <div className="w-8 h-8 rounded-lg bg-saffron-50 dark:bg-saffron-950/20 flex items-center justify-center text-saffron-600 dark:text-saffron-400">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold text-dark-900 dark:text-white leading-none">{analytics?.total_campaigns || 0}</h3>
                  </div>

                  <div className="bg-white dark:bg-dark-900/50 p-5 rounded-2xl border border-dark-200/50 dark:border-white/[0.04] relative overflow-hidden group hover:border-amber-500/30 transition-all duration-300">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/[0.02] rounded-bl-full pointer-events-none" />
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wide">{t('whatsapp.messages_sent', 'Messages Sent')}</p>
                      <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                        <Send className="w-4 h-4" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold text-dark-900 dark:text-white leading-none">{analytics?.total_messages || 0}</h3>
                  </div>

                  <div className="bg-white dark:bg-dark-900/50 p-5 rounded-2xl border border-dark-200/50 dark:border-white/[0.04] relative overflow-hidden group hover:border-sky-500/30 transition-all duration-300">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/[0.02] rounded-bl-full pointer-events-none" />
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wide">{t('whatsapp.delivered_rate', 'Delivered Rate')}</p>
                      <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/20 flex items-center justify-center text-sky-600 dark:text-sky-400">
                        <CheckCircle className="w-4 h-4" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold text-dark-900 dark:text-white leading-none">{analytics?.delivered_rate || 0}%</h3>
                  </div>

                  <div className="bg-white dark:bg-dark-900/50 p-5 rounded-2xl border border-dark-200/50 dark:border-white/[0.04] relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-300">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/[0.02] rounded-bl-full pointer-events-none" />
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wide">{t('whatsapp.read_rate', 'Read Rate')}</p>
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                        <CheckCircle className="w-4 h-4" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold text-dark-900 dark:text-white leading-none">{analytics?.read_rate || 0}%</h3>
                  </div>

                  <div className="bg-white dark:bg-dark-900/50 p-5 rounded-2xl border border-dark-200/50 dark:border-white/[0.04] relative overflow-hidden group hover:border-rose-500/30 transition-all duration-300">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/[0.02] rounded-bl-full pointer-events-none" />
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wide">{t('whatsapp.failed_rate', 'Failed Rate')}</p>
                      <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/20 flex items-center justify-center text-rose-600 dark:text-rose-400">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold text-dark-900 dark:text-white leading-none">{analytics?.failed_rate || 0}%</h3>
                  </div>

                </div>

                {/* Status Visual Representation */}
                <div className="bg-white dark:bg-dark-900/50 p-6 rounded-2xl border border-dark-200/50 dark:border-white/[0.04]">
                  <h3 className="text-base font-bold text-dark-900 dark:text-white mb-4">Real-Time Delivery Pipeline</h3>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs text-dark-500 dark:text-dark-400">
                      <div className="flex gap-4">
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" /> Read ({analytics?.read_count || 0})</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-sky-500 rounded-full" /> Delivered ({analytics?.delivered_count || 0})</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-slate-400 rounded-full" /> Sent ({analytics?.sent_count || 0})</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-rose-500 rounded-full" /> Failed ({analytics?.failed_count || 0})</span>
                      </div>
                      <span>{analytics?.total_messages || 0} Total Messages</span>
                    </div>

                    <div className="h-4 w-full bg-dark-100 dark:bg-dark-800 rounded-full overflow-hidden flex">
                      <div style={{ width: `${analytics?.total_messages ? (analytics.read_count / analytics.total_messages) * 100 : 0}%` }} className="h-full bg-emerald-500 transition-all duration-500" />
                      <div style={{ width: `${analytics?.total_messages ? (analytics.delivered_count / analytics.total_messages) * 100 : 0}%` }} className="h-full bg-sky-500 transition-all duration-500" />
                      <div style={{ width: `${analytics?.total_messages ? (analytics.sent_count / analytics.total_messages) * 100 : 0}%` }} className="h-full bg-slate-400 transition-all duration-500" />
                      <div style={{ width: `${analytics?.total_messages ? (analytics.failed_count / analytics.total_messages) * 100 : 0}%` }} className="h-full bg-rose-500 transition-all duration-500" />
                    </div>
                  </div>
                </div>

                {/* Recent Campaigns Overview */}
                <div className="bg-white dark:bg-dark-900/50 rounded-2xl border border-dark-200/50 dark:border-white/[0.04] p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-bold text-dark-900 dark:text-white">Active Campaigns Metrics</h3>
                    <button
                      onClick={() => setActiveTab('history')}
                      className="text-xs font-semibold text-saffron-600 dark:text-saffron-400 flex items-center gap-1 hover:underline"
                    >
                      View All Campaigns <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {campaigns.length === 0 ? (
                    <div className="text-center py-8 text-dark-500">{t('whatsapp.no_campaigns', 'No campaigns sent yet.')}</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {campaigns.slice(0, 3).map((camp) => {
                        const total = camp.recipient_count || 1;
                        const readPct = Math.round((camp.read_count / total) * 100);
                        const deliverPct = Math.round(((camp.delivered_count + camp.read_count) / total) * 100);
                        const failPct = Math.round((camp.failed_count / total) * 100);

                        return (
                          <div key={camp.id} className="p-4 rounded-xl border border-dark-100 dark:border-white/[0.03] bg-dark-50/20 space-y-3 relative group">
                            <div>
                              <h4 className="font-bold text-sm text-dark-900 dark:text-white truncate">{camp.name}</h4>
                              <p className="text-[10px] text-dark-500 dark:text-dark-400 mt-0.5">{new Date(camp.created_at).toLocaleString()}</p>
                            </div>

                            <div className="space-y-1">
                              <div className="flex justify-between text-xs font-semibold text-dark-700 dark:text-dark-400">
                                <span>Read Rate</span>
                                <span>{readPct}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-dark-100 dark:bg-dark-800 rounded-full overflow-hidden">
                                <div style={{ width: `${readPct}%` }} className="h-full bg-emerald-500" />
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-dark-500 dark:text-dark-400 pt-2 border-t border-dark-100 dark:border-white/[0.04]">
                              <span>Recipients: <strong className="text-dark-900 dark:text-white">{camp.recipient_count}</strong></span>
                              <button
                                onClick={() => handleViewCampaignDetails(camp)}
                                className="text-saffron-600 dark:text-saffron-400 font-bold hover:underline flex items-center gap-0.5"
                              >
                                <Eye className="w-3.5 h-3.5" /> Details
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ─── TAB 2: COMPOSE CAMPAIGN ─── */}
        {activeTab === 'compose' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">

            {/* LEFT 2 COLUMNS: RECIPIENT SELECTOR & COMPOSER */}
            <div className="lg:col-span-2 space-y-6">

              {/* Recipient Selector Grid */}
              <div className="bg-white dark:bg-dark-900/50 p-6 rounded-2xl border border-dark-200/50 dark:border-white/[0.04] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-dark-100 dark:border-white/[0.04] pb-4">
                  <div>
                    <h3 className="font-bold text-dark-900 dark:text-white flex items-center gap-2">
                      <Users className="w-4 h-4 text-saffron-500" />
                      {t('whatsapp.select_recipients', 'Select Recipients')}
                    </h3>
                    <p className="text-[11px] text-dark-500 dark:text-dark-400 mt-0.5">
                      {selectedRecipients.length} recipients selected
                    </p>
                  </div>

                  <button
                    onClick={handleSelectAll}
                    className="px-3 py-1.5 bg-dark-50 dark:bg-dark-800 hover:bg-dark-100 dark:hover:bg-dark-700/60 rounded-lg text-xs font-semibold text-dark-700 dark:text-dark-300 transition-colors w-max"
                  >
                    {recipients.every((r) => selectedRecipients.some((sr) => sr.id === r.id && sr.type === r.type))
                      ? 'Deselect All Visible'
                      : 'Select All Visible'}
                  </button>
                </div>

                {/* Search & Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-dark-400">
                      <Search className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search name or phone..."
                      className="w-full pl-9 pr-3 py-2 bg-dark-50 dark:bg-dark-900 rounded-lg border border-dark-200/60 dark:border-white/[0.04] text-xs text-dark-900 dark:text-white focus:outline-none focus:border-saffron-500"
                    />
                  </div>

                  <div>
                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value as any)}
                      className="w-full px-3 py-2 bg-dark-50 dark:bg-dark-900 rounded-lg border border-dark-200/60 dark:border-white/[0.04] text-xs text-dark-900 dark:text-white focus:outline-none focus:border-saffron-500"
                    >
                      <option value="all">All Categories</option>
                      <option value="voters">Voters</option>
                      <option value="party_members">Party Members</option>
                      <option value="workers">Workers</option>
                    </select>
                  </div>

                  {/* Ward filter */}
                  <div>
                    <select
                      value={wardFilter}
                      onChange={(e) => handleWardChange(e.target.value)}
                      className="w-full px-3 py-2 bg-dark-50 dark:bg-dark-900 rounded-lg border border-dark-200/60 dark:border-white/[0.04] text-xs text-dark-900 dark:text-white focus:outline-none focus:border-saffron-500"
                    >
                      <option value="">All Wards</option>
                      {wards.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Booth filter */}
                  <div>
                    <select
                      value={boothFilter}
                      onChange={(e) => setBoothFilter(e.target.value === '' ? '' : parseInt(e.target.value))}
                      disabled={!wardFilter}
                      className="w-full px-3 py-2 bg-dark-50 dark:bg-dark-900 rounded-lg border border-dark-200/60 dark:border-white/[0.04] text-xs text-dark-900 dark:text-white focus:outline-none focus:border-saffron-500 disabled:opacity-50"
                    >
                      <option value="">All Booths</option>
                      {booths.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Recipients List Table */}
                <div className="border border-dark-100 dark:border-white/[0.04] rounded-xl overflow-hidden max-h-72 overflow-y-auto custom-scrollbar">
                  {loadingRecipients ? (
                    <div className="flex items-center justify-center p-8">
                      <RefreshCw className="w-6 h-6 text-saffron-500 animate-spin" />
                    </div>
                  ) : recipients.length === 0 ? (
                    <div className="text-center p-8 text-xs text-dark-500">No matching contacts found.</div>
                  ) : (
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="bg-dark-50 dark:bg-dark-900 border-b border-dark-100 dark:border-white/[0.04] text-[10px] font-bold text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                          <th className="py-2.5 px-3 w-8"></th>
                          <th className="py-2.5 px-3">Name</th>
                          <th className="py-2.5 px-3">Phone</th>
                          <th className="py-2.5 px-3">Category</th>
                          <th className="py-2.5 px-3">Geography</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark-100 dark:divide-white/[0.03] text-xs">
                        {recipients.map((rec) => {
                          const isChecked = selectedRecipients.some((r) => r.id === rec.id && r.type === rec.type);
                          return (
                            <tr
                              key={`${rec.type}_${rec.id}`}
                              onClick={() => handleToggleRecipient(rec)}
                              className={`hover:bg-dark-50/50 dark:hover:bg-dark-800/10 cursor-pointer ${isChecked ? 'bg-saffron-500/[0.02]' : ''}`}
                            >
                              <td className="py-2.5 px-3">
                                {isChecked ? (
                                  <CheckSquare className="w-4 h-4 text-saffron-500" />
                                ) : (
                                  <Square className="w-4 h-4 text-dark-300 dark:text-dark-700" />
                                )}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-dark-900 dark:text-white">{rec.name}</td>
                              <td className="py-2.5 px-3 text-dark-600 dark:text-dark-400">{rec.phone}</td>
                              <td className="py-2.5 px-3">
                                <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${rec.type === 'voter' ? 'bg-violet-100 text-violet-600 dark:bg-violet-950/20 dark:text-violet-400' : rec.type === 'party_member' ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400'}`}>
                                  {rec.type === 'party_member' ? 'Party Supporter' : rec.type.charAt(0).toUpperCase() + rec.type.slice(1)}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-dark-500 dark:text-dark-500 text-[11px]">
                                {rec.ward_name} {rec.booth_name ? `• ${rec.booth_name}` : ''}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Message Composer */}
              <div className="bg-white dark:bg-dark-900/50 p-6 rounded-2xl border border-dark-200/50 dark:border-white/[0.04] space-y-4">
                <h3 className="font-bold text-dark-900 dark:text-white flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-saffron-500" />
                  {t('whatsapp.message_composer', 'Message Composer')}
                </h3>

                <div className="space-y-3">

                  {/* Campaign name */}
                  <div>
                    <label className="block text-xs font-semibold text-dark-700 dark:text-dark-400 mb-1">Campaign Title *</label>
                    <input
                      type="text"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      placeholder="e.g., Ward 4 Vote Reminder Outreach"
                      className="w-full px-3 py-2 bg-dark-50 dark:bg-dark-900 rounded-lg border border-dark-200/60 dark:border-white/[0.04] text-xs text-dark-900 dark:text-white focus:outline-none focus:border-saffron-500 font-medium"
                    />
                  </div>

                  {/* Template picker */}
                  <div>
                    <label className="block text-xs font-semibold text-dark-700 dark:text-dark-400 mb-1">WhatsApp Approved Template (Optional)</label>
                    <select
                      value={selectedTemplate?.name || ''}
                      onChange={(e) => {
                        const name = e.target.value;
                        if (!name) {
                          setSelectedTemplate(null);
                        } else {
                          const matched = templates.find((t) => t.name === name);
                          if (matched) setSelectedTemplate({ ...matched }); // Clone template to edit custom text
                        }
                      }}
                      className="w-full px-3 py-2 bg-dark-50 dark:bg-dark-900 rounded-lg border border-dark-200/60 dark:border-white/[0.04] text-xs text-dark-900 dark:text-white focus:outline-none focus:border-saffron-500"
                    >
                      <option value="">-- Use Custom / Standard Text --</option>
                      {templates.map((temp) => (
                        <option key={temp.id} value={temp.name}>
                          {temp.name} ({temp.language.toUpperCase()})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Event Details placeholder content if using Event placeholder */}
                  <div>
                    <label className="block text-xs font-semibold text-dark-700 dark:text-dark-400 mb-1">
                      Event Details (Replaces <code className="text-saffron-500">{"{{Event}}"}</code> variable)
                    </label>
                    <input
                      type="text"
                      value={eventDetails}
                      onChange={(e) => setEventDetails(e.target.value)}
                      placeholder="e.g., Public Gathering, June 20, 6:00 PM"
                      className="w-full px-3 py-2 bg-dark-50 dark:bg-dark-900 rounded-lg border border-dark-200/60 dark:border-white/[0.04] text-xs text-dark-900 dark:text-white focus:outline-none focus:border-saffron-500"
                    />
                  </div>

                  {/* Body Text */}
                  <div className="relative">
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs font-semibold text-dark-700 dark:text-dark-400">Message Content *</label>

                      {/* Emojis Trigger */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                          className="text-dark-400 hover:text-saffron-500 transition-colors p-1"
                          title="Add Emojis"
                        >
                          <Smile className="w-4 h-4" />
                        </button>

                        {showEmojiPicker && (
                          <div className="absolute right-0 bottom-full mb-1 p-2 bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-white/[0.06] shadow-xl grid grid-cols-6 gap-1 w-max z-20">
                            {EMOJIS.map((e) => (
                              <button
                                key={e}
                                onClick={() => handleInsertEmoji(e)}
                                className="w-7 h-7 text-sm flex items-center justify-center hover:bg-dark-50 dark:hover:bg-dark-700 rounded transition-all"
                              >
                                {e}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <textarea
                      ref={textareaRef}
                      rows={4}
                      value={selectedTemplate ? selectedTemplate.body_text : customMessage}
                      onChange={(e) => {
                        if (selectedTemplate) {
                          setSelectedTemplate({ ...selectedTemplate, body_text: e.target.value });
                        } else {
                          setCustomMessage(e.target.value);
                        }
                      }}
                      placeholder={t('whatsapp.enter_message', 'Enter custom message...')}
                      className="w-full px-3 py-2 bg-dark-50 dark:bg-dark-900 rounded-lg border border-dark-200/60 dark:border-white/[0.04] text-xs text-dark-900 dark:text-white focus:outline-none focus:border-saffron-500 font-medium"
                    />
                  </div>

                  {/* Placeholders Injection buttons */}
                  <div>
                    <span className="block text-[10px] text-dark-500 dark:text-dark-500 uppercase font-bold tracking-wider mb-1.5">
                      Insert Placeholders
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {['Name', 'Ward', 'Booth', 'Constituency', 'Event'].map((ph) => (
                        <button
                          key={ph}
                          type="button"
                          onClick={() => handleInsertPlaceholder(ph)}
                          className="px-2.5 py-1 text-[10px] bg-dark-50 hover:bg-dark-100 dark:bg-dark-800 dark:hover:bg-dark-700 rounded text-dark-700 dark:text-dark-300 border border-dark-200/40 dark:border-white/[0.04] font-semibold transition-all"
                        >
                          {"{{" + ph + "}}"}
                        </button>
                      ))}
                    </div>
                  </div>

                </div>
              </div>

            </div>

            {/* RIGHT 1 COLUMN: LIVE PREVIEW & SEND TRIGGER */}
            <div className="space-y-6">

              {/* Live WhatsApp Preview */}
              <div className="bg-white dark:bg-dark-900/50 p-6 rounded-2xl border border-dark-200/50 dark:border-white/[0.04] relative overflow-hidden flex flex-col h-full justify-between min-h-[400px]">

                <div className="space-y-4">
                  <h3 className="font-bold text-dark-900 dark:text-white flex items-center gap-2">
                    <Eye className="w-4 h-4 text-saffron-500" />
                    {t('whatsapp.live_preview', 'Live Preview')}
                  </h3>

                  {/* Mock Phone Shell Interface */}
                  <div className="bg-dark-50 dark:bg-dark-950/40 rounded-2xl p-4 border border-dark-200/40 dark:border-white/[0.03] space-y-3 shadow-inner">

                    {/* Phone Header */}
                    <div className="flex items-center gap-2 border-b border-dark-100 dark:border-white/[0.03] pb-2">
                      <div className="w-6 h-6 rounded-full bg-saffron-500 text-white text-[9px] font-extrabold flex items-center justify-center">
                        WA
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-dark-900 dark:text-white leading-none">WhatsApp Campaign Bot</span>
                        <span className="block text-[8px] text-emerald-500 font-semibold mt-0.5">Online</span>
                      </div>
                    </div>

                    {/* Message Bubble */}
                    <div className="bg-emerald-100 dark:bg-emerald-950/20 text-dark-900 dark:text-dark-100 rounded-xl p-3 text-xs w-11/12 ml-auto shadow-sm border border-emerald-200/30 relative">
                      <p className="whitespace-pre-wrap leading-relaxed">{getMessagePreview()}</p>
                      <span className="block text-[8px] text-right mt-1 text-emerald-700/60 dark:text-emerald-400/60 font-semibold">
                        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {/* Small triangle arrow on the bubble */}
                      <div className="absolute right-[-4px] top-3 w-2 h-2 bg-emerald-100 dark:bg-emerald-950/20 rotate-45 border-r border-t border-emerald-200/30" />
                    </div>

                  </div>
                </div>

                {/* Action trigger button */}
                <div className="pt-4 border-t border-dark-100 dark:border-white/[0.04]">
                  <button
                    onClick={handleSendCampaign}
                    disabled={sending || selectedRecipients.length === 0}
                    className="w-full h-11 bg-gradient-to-r from-saffron-500 to-amber-600 hover:from-saffron-600 hover:to-amber-700 text-white font-bold rounded-xl shadow-lg shadow-saffron-500/10 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    {sending ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Sending Campaign...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Send to {selectedRecipients.length} Recipient(s)
                      </>
                    )}
                  </button>
                </div>

              </div>

            </div>

          </div>
        )}

        {/* ─── TAB 3: CAMPAIGN HISTORY ─── */}
        {activeTab === 'history' && (
          <div className="bg-white dark:bg-dark-900/50 rounded-2xl border border-dark-200/50 dark:border-white/[0.04] p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-dark-900 dark:text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-saffron-500" />
                {t('whatsapp.history', 'Campaign History')}
              </h3>
              <button
                onClick={() => fetchCampaigns(true)}
                className="p-1.5 rounded-lg border border-dark-200/60 dark:border-white/[0.04] hover:bg-dark-50 dark:hover:bg-dark-800 text-dark-500 hover:text-dark-900"
                title="Refresh Campaigns"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {loadingCampaigns && campaigns.length === 0 ? (
              <div className="flex items-center justify-center p-12">
                <RefreshCw className="w-8 h-8 text-saffron-500 animate-spin" />
              </div>
            ) : campaigns.length === 0 ? (
              <div className="text-center py-12 text-sm text-dark-500">No campaigns recorded yet. Create one to get started!</div>
            ) : (
              <div className="border border-dark-100 dark:border-white/[0.04] rounded-xl overflow-hidden">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-dark-50 dark:bg-dark-900 border-b border-dark-100 dark:border-white/[0.04] font-bold text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Campaign Name</th>
                      <th className="py-3 px-4">Sent By</th>
                      <th className="py-3 px-4">Recipients</th>
                      <th className="py-3 px-4">Read Rate</th>
                      <th className="py-3 px-4">Failed Rate</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-100 dark:divide-white/[0.03]">
                    {campaigns.map((camp) => {
                      const total = camp.recipient_count || 1;
                      const readRate = Math.round((camp.read_count / total) * 100);
                      const failedRate = Math.round((camp.failed_count / total) * 100);

                      return (
                        <tr key={camp.id} className="hover:bg-dark-50/40 dark:hover:bg-dark-800/10">
                          <td className="py-3 px-4 font-bold text-dark-900 dark:text-white">{camp.name}</td>
                          <td className="py-3 px-4 text-dark-600 dark:text-dark-400">{camp.sender_name}</td>
                          <td className="py-3 px-4 font-semibold text-dark-900 dark:text-white">{camp.recipient_count}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full font-bold bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 text-[10px]">
                              {readRate}% Read ({camp.read_count})
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {failedRate > 0 ? (
                              <span className="px-2 py-0.5 rounded-full font-bold bg-rose-50 dark:bg-rose-950/20 text-rose-600 text-[10px]">
                                {failedRate}% Failed ({camp.failed_count})
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full font-bold bg-slate-50 dark:bg-slate-900 text-slate-400 text-[10px]">
                                0%
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-dark-500 dark:text-dark-400">{new Date(camp.created_at).toLocaleString()}</td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleViewCampaignDetails(camp)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-dark-50 hover:bg-dark-100 dark:bg-dark-850 dark:hover:bg-dark-750 text-xs font-bold text-dark-750 dark:text-dark-200 rounded-lg transition-all border border-dark-100 dark:border-white/[0.04]"
                            >
                              <Eye className="w-3.5 h-3.5" /> Details
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 4: TEMPLATES MANAGER ─── */}
        {activeTab === 'templates' && (
          <div className="bg-white dark:bg-dark-900/50 rounded-2xl border border-dark-200/50 dark:border-white/[0.04] p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-4 border-b border-dark-100 dark:border-white/[0.04] pb-4">
              <div>
                <h3 className="font-bold text-dark-900 dark:text-white flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-saffron-500" />
                  Template Manager
                </h3>
                <p className="text-xs text-dark-500 dark:text-dark-400 mt-0.5">Manage meta-approved template message bodies</p>
              </div>

              <button
                onClick={() => setShowNewTemplateModal(true)}
                className="h-9 px-4 bg-gradient-to-r from-saffron-500 to-amber-600 hover:from-saffron-600 hover:to-amber-700 text-white font-bold rounded-lg text-xs shadow-md shadow-saffron-500/10 flex items-center gap-1.5 transition-all"
              >
                <Plus className="w-4 h-4" /> Create Template
              </button>
            </div>

            {loadingTemplates && templates.length === 0 ? (
              <div className="flex items-center justify-center p-12">
                <RefreshCw className="w-8 h-8 text-saffron-500 animate-spin" />
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-12 text-sm text-dark-500">No custom templates created yet. Click &quot;Create Template&quot; to add one.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map((temp) => (
                  <div key={temp.id} className="p-4 rounded-xl border border-dark-100 dark:border-white/[0.04] bg-dark-50/20 relative space-y-3 group hover:border-saffron-500/30 transition-all duration-300">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-sm text-dark-900 dark:text-white">{temp.name}</h4>
                        <span className="px-2 py-0.5 text-[8px] font-bold uppercase bg-dark-100 dark:bg-dark-800 text-dark-600 dark:text-dark-400 rounded-full mt-1 inline-block">
                          {temp.category} • {temp.language.toUpperCase()}
                        </span>
                      </div>

                      {/* Show delete action only if not seeded system template */}
                      {temp.id > 6 && (
                        <button
                          onClick={() => handleDeleteTemplate(temp.id)}
                          className="p-1 text-dark-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete Template"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="p-3 bg-white dark:bg-dark-950/30 rounded-lg text-xs border border-dark-100 dark:border-white/[0.02] text-dark-700 dark:text-dark-300 leading-relaxed font-mono">
                      {temp.body_text}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── MODAL: CAMPAIGN LOG MESSAGES DETAILS ─── */}
        {showDetailsModal && selectedCampaign && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-dark-900 rounded-2xl border border-dark-200 dark:border-white/[0.08] shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col animate-scale-in">

              {/* Modal Header */}
              <div className="p-6 border-b border-dark-100 dark:border-white/[0.06] flex items-center justify-between flex-shrink-0">
                <div>
                  <h3 className="font-bold text-base text-dark-900 dark:text-white">{selectedCampaign.name}</h3>
                  <p className="text-xs text-dark-500 dark:text-dark-400 mt-0.5">Campaign logs & real-time delivery audit trail</p>
                </div>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="p-1 text-dark-400 hover:text-dark-900 dark:hover:text-white hover:bg-dark-50 dark:hover:bg-dark-800 rounded-lg"
                >
                  <Trash2 className="w-4 h-4 rotate-45" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">

                {/* Campaign Statistics Overview */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-dark-50/50 dark:bg-dark-950/20 border border-dark-100 dark:border-white/[0.02]">
                  <div>
                    <span className="block text-[10px] uppercase font-bold tracking-wider text-dark-400">Total Contacts</span>
                    <span className="block text-lg font-bold text-dark-900 dark:text-white mt-0.5">{selectedCampaign.recipient_count}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold tracking-wider text-emerald-500">Read Receipts</span>
                    <span className="block text-lg font-bold text-emerald-600 mt-0.5">{selectedCampaign.read_count}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold tracking-wider text-sky-500">Delivered</span>
                    <span className="block text-lg font-bold text-sky-600 mt-0.5">{selectedCampaign.delivered_count}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold tracking-wider text-rose-500">Failed</span>
                    <span className="block text-lg font-bold text-rose-600 mt-0.5">{selectedCampaign.failed_count}</span>
                  </div>
                </div>

                {/* Logs Table */}
                <div className="border border-dark-100 dark:border-white/[0.04] rounded-xl overflow-hidden">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-dark-50 dark:bg-dark-900 border-b border-dark-100 dark:border-white/[0.04] font-bold text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                        <th className="py-2.5 px-3">Recipient</th>
                        <th className="py-2.5 px-3">Phone</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Rendered Message</th>
                        <th className="py-2.5 px-3 text-right">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-100 dark:divide-white/[0.03]">
                      {loadingMessages && campaignMessages.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center">
                            <RefreshCw className="w-6 h-6 text-saffron-500 animate-spin mx-auto" />
                          </td>
                        </tr>
                      ) : campaignMessages.map((msg) => (
                        <tr key={msg.id} className="hover:bg-dark-50/20 dark:hover:bg-dark-800/10">
                          <td className="py-2.5 px-3 font-semibold text-dark-900 dark:text-white">{msg.recipient_name}</td>
                          <td className="py-2.5 px-3 text-dark-600 dark:text-dark-400">{msg.recipient_phone}</td>
                          <td className="py-2.5 px-3">{getStatusBadge(msg.status)}</td>
                          <td className="py-2.5 px-3 text-dark-700 dark:text-dark-300 max-w-xs truncate" title={msg.message_text}>
                            {msg.message_text}
                          </td>
                          <td className="py-2.5 px-3 text-right text-rose-500 text-[10px] font-semibold max-w-xs truncate">
                            {msg.error_message || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-dark-100 dark:border-white/[0.06] flex justify-end">
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="px-4 py-2 bg-dark-50 dark:bg-dark-800 hover:bg-dark-100 text-xs font-semibold rounded-lg border border-dark-200/50 text-dark-700 dark:text-dark-300 transition-all"
                >
                  Close Logs
                </button>
              </div>

            </div>
          </div>
        )}

        {/* ─── MODAL: CREATE TEMPLATE ─── */}
        {showNewTemplateModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <form
              onSubmit={handleCreateTemplate}
              className="bg-white dark:bg-dark-900 rounded-2xl border border-dark-200 dark:border-white/[0.08] shadow-2xl w-full max-w-lg flex flex-col animate-scale-in"
            >
              {/* Header */}
              <div className="p-6 border-b border-dark-100 dark:border-white/[0.06] flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base text-dark-900 dark:text-white">{t('whatsapp.new_template_title', 'New Message Template')}</h3>
                  <p className="text-xs text-dark-500 dark:text-dark-400 mt-0.5">Submit a message template for campaigns</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewTemplateModal(false)}
                  className="p-1 text-dark-400 hover:text-dark-900 dark:hover:text-white hover:bg-dark-50 dark:hover:bg-dark-800 rounded-lg"
                >
                  <Trash2 className="w-4 h-4 rotate-45" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">

                <div>
                  <label className="block text-xs font-semibold text-dark-700 dark:text-dark-400 mb-1">Template Name *</label>
                  <input
                    type="text"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder="e.g., Event Invitation Template"
                    required
                    className="w-full px-3 py-2 bg-dark-50 dark:bg-dark-900 rounded-lg border border-dark-200/60 dark:border-white/[0.04] text-xs text-dark-900 dark:text-white focus:outline-none focus:border-saffron-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-dark-700 dark:text-dark-400 mb-1">Category</label>
                    <select
                      value={newTemplateCategory}
                      onChange={(e) => setNewTemplateCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-dark-50 dark:bg-dark-900 rounded-lg border border-dark-200/60 dark:border-white/[0.04] text-xs text-dark-900 dark:text-white focus:outline-none focus:border-saffron-500"
                    >
                      <option value="utility">Utility</option>
                      <option value="marketing">Marketing</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-dark-700 dark:text-dark-400 mb-1">Language</label>
                    <select
                      value={newTemplateLanguage}
                      onChange={(e) => setNewTemplateLanguage(e.target.value)}
                      className="w-full px-3 py-2 bg-dark-50 dark:bg-dark-900 rounded-lg border border-dark-200/60 dark:border-white/[0.04] text-xs text-dark-900 dark:text-white focus:outline-none focus:border-saffron-500"
                    >
                      <option value="en">English (EN)</option>
                      <option value="hi">Hindi (HI)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-semibold text-dark-700 dark:text-dark-400">Template Body *</label>
                    <span className="text-[10px] text-dark-400">Include variables like {"{{Name}}"} or {"{{Ward}}"}.</span>
                  </div>
                  <textarea
                    rows={4}
                    value={newTemplateBody}
                    onChange={(e) => setNewTemplateBody(e.target.value)}
                    placeholder="e.g. Hello {{Name}}, you are invited to attend our election event in Ward {{Ward}}."
                    required
                    className="w-full px-3 py-2 bg-dark-50 dark:bg-dark-900 rounded-lg border border-dark-200/60 dark:border-white/[0.04] text-xs text-dark-900 dark:text-white focus:outline-none focus:border-saffron-500 leading-relaxed font-mono"
                  />
                </div>

              </div>

              {/* Footer */}
              <div className="p-4 border-t border-dark-100 dark:border-white/[0.06] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewTemplateModal(false)}
                  className="px-4 py-2 bg-dark-50 dark:bg-dark-800 hover:bg-dark-100 text-xs font-semibold rounded-lg border border-dark-200/50 text-dark-700 dark:text-dark-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingTemplate}
                  className="px-4 py-2 bg-gradient-to-r from-saffron-500 to-amber-600 hover:from-saffron-600 hover:to-amber-700 text-white font-bold rounded-lg text-xs shadow-md shadow-saffron-500/10 flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {creatingTemplate ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  Create Template
                </button>
              </div>

            </form>
          </div>
        )}
      </div>
    </>
  );
}
