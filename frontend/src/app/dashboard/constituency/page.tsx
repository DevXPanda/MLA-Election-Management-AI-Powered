'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { showToast } from '@/lib/toast';
import Header from '@/components/Header';
import { constituencyAPI, usersAPI } from '@/lib/api';
import { State, District, Constituency, Area, Ward, Booth, User } from '@/types';
import { Plus, X, Loader2, MapPin, ChevronRight, Building2, Home, Edit3, Trash2, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Modal from '@/components/Modal';
import { MODULE_HEADER, CONSTITUENCY_UI } from '@/lib/ui-labels';
import { useLanguage } from '@/context/LanguageContext';

export default function ConstituencyPage() {
  const { t, language } = useLanguage();
  const { user: currentUser } = useAuth();
  const [states, setStates] = useState<State[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [constituencies, setConstituencies] = useState<Constituency[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [booths, setBooths] = useState<Booth[]>([]);
  const [managers, setManagers] = useState<User[]>([]);
  const [wardHeads, setWardHeads] = useState<User[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [selectedState, setSelectedState] = useState<number | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<number | null>(null);
  const [selectedConstituency, setSelectedConstituency] = useState<number | null>(null);
  const [selectedArea, setSelectedArea] = useState<number | null>(null);
  const [selectedWard, setSelectedWard] = useState<number | null>(null);

  // Modal State
  const [modalType, setModalType] = useState<'state' | 'district' | 'constituency' | 'area' | 'ward' | 'booth' | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [form, setForm] = useState<any>({ 
    name: '', number: '', code: '', mla_name: '',
    manager_id: '', ward_head_id: '', address: '' 
  });

  // Multi-step Structure Modal State
  const [showStructureModal, setShowStructureModal] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [structureForm, setStructureForm] = useState({
    state: { mode: 'select' as 'select' | 'create', id: '', name: '', code: '' },
    district: { mode: 'select' as 'select' | 'create', id: '', name: '' },
    constituency: { mode: 'select' as 'select' | 'create', id: '', name: '', number: '', mla_name: '' },
    area: { name: '', manager_id: '' },
    ward: { name: '', number: '', ward_head_id: '' },
    booth: { name: '', number: '', address: '' }
  });

  const canManageHierarchy = currentUser?.role_name === 'super_admin' || currentUser?.role_name === 'mla';
  const isSuper = currentUser?.role_name === 'super_admin';
  const isMLA = currentUser?.role_name === 'mla';

  const getUnitTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      state: 'label.state',
      district: 'label.district',
      constituency: 'label.constituency',
      area: 'label.area',
      ward: 'label.ward',
      booth: 'label.booth'
    };
    return t(map[type] || `label.${type}`);
  };

  const getModalTitle = () => {
    const unitLabel = getUnitTypeLabel(modalType || '');
    if (editingItem) {
      return language === 'hi' ? `${unitLabel} संशोधित करें` : `Edit ${unitLabel}`;
    }
    return language === 'hi' ? `नया ${unitLabel} जोड़ें` : `Add New ${unitLabel}`;
  };

  const getModalSubtitle = () => {
    if (editingItem) {
      return t('const.modal.edit_unit_sub');
    }
    return t('const.modal.add_unit_sub');
  };

  useEffect(() => { 
    loadInitial(); 
    loadUsers();
  }, []);

  const loadInitial = async () => {
    try {
      const [statesRes, constituenciesRes] = await Promise.all([
        constituencyAPI.getStates(),
        constituencyAPI.getConstituencies(),
      ]);
      setStates(statesRes.data.data);
      if (!selectedDistrict) setConstituencies(constituenciesRes.data.data);
      
      // MLA: auto-select their constituency and skip to Areas view
      if (isMLA && currentUser?.constituency_id) {
        const mlaConst = constituenciesRes.data.data[0]; // API already filtered to MLA's constituency
        if (mlaConst) {
          // Auto-navigate to the MLA's constituency hierarchy
          if (statesRes.data.data.length > 0) {
            setSelectedState(statesRes.data.data[0].id);
          }
          setSelectedConstituency(mlaConst.id);
          // Load areas immediately
          const areasRes = await constituencyAPI.getAreas(mlaConst.id);
          setAreas(areasRes.data.data);
        }
      }
    } catch {} finally { setLoading(false); }
  };

  const loadUsers = async () => {
    try {
      const res = await usersAPI.getAll();
      const allUsers = res.data.data;
      setManagers(allUsers.filter((u: User) => u.role_name === 'campaign_manager'));
      setWardHeads(allUsers.filter((u: User) => u.role_name === 'ward_head'));
    } catch {}
  };

  useEffect(() => {
    if (selectedState) {
      constituencyAPI.getDistricts(selectedState).then(res => setDistricts(res.data.data));
    } else {
      setDistricts([]);
    }
  }, [selectedState]);

  useEffect(() => {
    if (selectedDistrict) {
      constituencyAPI.getConstituencies(selectedDistrict).then(res => setConstituencies(res.data.data));
    }
  }, [selectedDistrict]);

  useEffect(() => {
    if (selectedConstituency) {
      constituencyAPI.getAreas(selectedConstituency).then(res => setAreas(res.data.data));
    }
  }, [selectedConstituency]);

  useEffect(() => {
    if (selectedArea) {
      constituencyAPI.getWards(undefined, selectedArea).then(res => setWards(res.data.data));
    }
  }, [selectedArea]);

  useEffect(() => {
    if (selectedWard) {
      constituencyAPI.getBooths(selectedWard).then(res => setBooths(res.data.data));
    }
  }, [selectedWard]);

  const openCreate = (type: 'state' | 'district' | 'constituency' | 'area' | 'ward' | 'booth') => {
    setModalType(type);
    setEditingItem(null);
    setForm({ 
      name: '', number: '', code: '', mla_name: '',
      manager_id: '', ward_head_id: '', address: '' 
    });
    setShowModal(true);
  };

  const openEdit = (type: 'state' | 'district' | 'constituency' | 'area' | 'ward' | 'booth', item: any) => {
    setModalType(type);
    setEditingItem(item);
    setForm({
      name: item.name,
      number: item.number || '',
      code: item.code || '',
      mla_name: item.mla_name || '',
      manager_id: item.manager_id || '',
      ward_head_id: item.ward_head_id || '',
      address: item.address || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (modalType === 'state') {
        if (editingItem) await constituencyAPI.updateState(editingItem.id, { name: form.name, code: form.code });
        else await constituencyAPI.createState({ name: form.name, code: form.code });
        constituencyAPI.getStates().then(res => setStates(res.data.data));
      } else if (modalType === 'district') {
        if (editingItem) await constituencyAPI.updateDistrict(editingItem.id, { name: form.name, state_id: selectedState });
        else await constituencyAPI.createDistrict({ name: form.name, state_id: selectedState });
        if (selectedState) constituencyAPI.getDistricts(selectedState).then(res => setDistricts(res.data.data));
      } else if (modalType === 'constituency') {
        if (editingItem) await constituencyAPI.updateConstituency(editingItem.id, { name: form.name, number: form.number, district_id: selectedDistrict, mla_name: form.mla_name });
        else await constituencyAPI.createConstituency({ name: form.name, number: form.number, district_id: selectedDistrict, mla_name: form.mla_name });
        if (selectedDistrict) constituencyAPI.getConstituencies(selectedDistrict).then(res => setConstituencies(res.data.data));
        else loadInitial();
      } else if (modalType === 'area') {
        if (editingItem) await constituencyAPI.updateArea(editingItem.id, { name: form.name, manager_id: form.manager_id || null });
        else await constituencyAPI.createArea({ name: form.name, constituency_id: selectedConstituency, manager_id: form.manager_id || null });
        constituencyAPI.getAreas(selectedConstituency!).then(res => setAreas(res.data.data));
      } else if (modalType === 'ward') {
        if (editingItem) await constituencyAPI.updateWard(editingItem.id, { name: form.name, number: form.number, constituency_id: selectedConstituency, area_id: selectedArea, ward_head_id: form.ward_head_id || null });
        else await constituencyAPI.createWard({ name: form.name, number: form.number, constituency_id: selectedConstituency, area_id: selectedArea, ward_head_id: form.ward_head_id || null });
        constituencyAPI.getWards(undefined, selectedArea!).then(res => setWards(res.data.data));
      } else if (modalType === 'booth') {
        if (editingItem) await constituencyAPI.updateBooth(editingItem.id, { name: form.name, number: form.number, ward_id: selectedWard, address: form.address });
        else await constituencyAPI.createBooth({ name: form.name, number: form.number, ward_id: selectedWard, address: form.address });
        constituencyAPI.getBooths(selectedWard!).then(res => setBooths(res.data.data));
      }
      setShowModal(false);
    } catch (err: any) { 
      showToast.error(err.response?.data?.message || t('label.unknown', 'Error')); 
    }
  };

  const handleDeleteState = async (id: number) => {
    showToast.confirm(
      t('label.delete_state'),
      t('label.delete_state_msg'),
      async () => {
        try {
          await constituencyAPI.deleteState(id);
          constituencyAPI.getStates().then(res => setStates(res.data.data));
          toast.success(t('const.success.state_delete'));
        } catch {
          showToast.error(t('const.error.state_delete'));
        }
      },
      t('action.delete')
    );
  };

  const handleDeleteDistrict = async (id: number) => {
    showToast.confirm(
      t('label.delete_district'),
      t('label.delete_district_msg'),
      async () => {
        try {
          await constituencyAPI.deleteDistrict(id);
          if (selectedState) constituencyAPI.getDistricts(selectedState).then(res => setDistricts(res.data.data));
          toast.success(t('const.success.district_delete'));
        } catch {
          showToast.error(t('const.error.district_delete'));
        }
      },
      t('action.delete')
    );
  };

  const handleDeleteConstituency = async (id: number) => {
    showToast.confirm(
      t('label.delete_constituency'),
      t('label.delete_constituency_msg'),
      async () => {
        try {
          await constituencyAPI.deleteConstituency(id);
          if (selectedDistrict) constituencyAPI.getConstituencies(selectedDistrict).then(res => setConstituencies(res.data.data));
          else loadInitial();
          toast.success(t('const.success.constituency_delete'));
        } catch {
          showToast.error(t('const.error.constituency_delete'));
        }
      },
      t('action.delete')
    );
  };

  const handleStructureSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let stateId = structureForm.state.id;
      if (structureForm.state.mode === 'create') {
        const res = await constituencyAPI.createState({ name: structureForm.state.name, code: structureForm.state.code });
        stateId = res.data.data.id;
      }

      let districtId = structureForm.district.id;
      if (structureForm.district.mode === 'create') {
        const res = await constituencyAPI.createDistrict({ name: structureForm.district.name, state_id: stateId });
        districtId = res.data.data.id;
      }

      let constituencyId = structureForm.constituency.id;
      if (structureForm.constituency.mode === 'create') {
        const res = await constituencyAPI.createConstituency({ 
          name: structureForm.constituency.name, 
          number: structureForm.constituency.number, 
          district_id: districtId, 
          mla_name: structureForm.constituency.mla_name 
        });
        constituencyId = res.data.data.id;
      }

      const areaRes = await constituencyAPI.createArea({ 
        name: structureForm.area.name, 
        constituency_id: constituencyId, 
        manager_id: structureForm.area.manager_id || null 
      });
      const areaId = areaRes.data.data.id;

      const wardRes = await constituencyAPI.createWard({ 
        name: structureForm.ward.name, 
        number: structureForm.ward.number, 
        constituency_id: constituencyId, 
        area_id: areaId, 
        ward_head_id: structureForm.ward.ward_head_id || null 
      });
      const wardId = wardRes.data.data.id;

      await constituencyAPI.createBooth({ 
        name: structureForm.booth.name, 
        number: structureForm.booth.number, 
        ward_id: wardId, 
        address: structureForm.booth.address 
      });

      setShowStructureModal(false);
      setCurrentStep(1);
      loadInitial();
      toast.success(t('label.structure_success'));
    } catch (err: any) {
      showToast.error(err.response?.data?.message || t('label.structure_failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteArea = async (id: number) => {
    showToast.confirm(
      t('label.delete_area'),
      t('label.delete_area_msg'),
      async () => {
        try {
          await constituencyAPI.deleteArea(id);
          constituencyAPI.getAreas(selectedConstituency!).then(res => setAreas(res.data.data));
          toast.success(t('const.success.area_delete'));
        } catch {
          showToast.error(t('const.error.area_delete'));
        }
      },
      t('action.delete')
    );
  };

  const handleDeleteWard = async (id: number) => {
    showToast.confirm(
      t('label.delete_ward'),
      t('label.delete_ward_msg'),
      async () => {
        try {
          await constituencyAPI.deleteWard(id);
          constituencyAPI.getWards(undefined, selectedArea!).then(res => setWards(res.data.data));
          toast.success(t('const.success.ward_delete'));
        } catch {
          showToast.error(t('const.error.ward_delete'));
        }
      },
      t('action.delete')
    );
  };

  const handleDeleteBooth = async (id: number) => {
    showToast.confirm(
      t('label.delete_booth'),
      t('label.delete_booth_msg'),
      async () => {
        try {
          await constituencyAPI.deleteBooth(id);
          constituencyAPI.getBooths(selectedWard!).then(res => setBooths(res.data.data));
          toast.success(t('const.success.booth_delete'));
        } catch {
          showToast.error(t('const.error.booth_delete'));
        }
      },
      t('action.delete')
    );
  };

  if (loading) return (
    <>
      <Header title={MODULE_HEADER.constituency.title} subtitle={MODULE_HEADER.constituency.subtitle} />
      <div className="p-8 flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-saffron-400" /></div>
    </>
  );

  return (
    <>
      <Header title={MODULE_HEADER.constituency.title} subtitle={CONSTITUENCY_UI.subtitleDetail} />
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-bold flex items-center gap-2">{CONSTITUENCY_UI.sectionHeading}</h2>
          {canManageHierarchy && !isMLA && (
            <button 
              onClick={() => setShowStructureModal(true)} 
              className="btn-primary py-2.5 px-6 flex items-center gap-2 shadow-lg shadow-saffron-500/20"
            >
              <Plus className="w-5 h-5" />
              <span>{t('label.create_structure')}</span>
            </button>
          )}
        </div>

        {/* Breadcrumb / Selection Flow */}
        <div className="flex items-center gap-2 mb-8 text-sm flex-wrap p-1 rounded-xl bg-dark-50/50 dark:bg-white/[0.02] border border-dark-100 dark:border-white/5">
          {/* MLA users skip State/District/Constituency breadcrumbs */}
          {!isMLA && (
            <button 
              onClick={() => { setSelectedState(null); setSelectedDistrict(null); setSelectedConstituency(null); setSelectedArea(null); setSelectedWard(null); }}
              className={`filter-tab ${!selectedState ? 'active' : ''}`}
            >
              {t('label.states')}
            </button>
          )}
          
          {selectedState && !isMLA && (
            <>
              <ChevronRight className="w-4 h-4 text-dark-300 dark:text-dark-500" />
              <button 
                onClick={() => { setSelectedDistrict(null); setSelectedConstituency(null); setSelectedArea(null); setSelectedWard(null); }}
                className={`filter-tab ${selectedState && !selectedDistrict ? 'active' : ''}`}
              >
                {t('label.districts')}
              </button>
            </>
          )}
          
          {selectedDistrict && !isMLA && (
            <>
              <ChevronRight className="w-4 h-4 text-dark-300 dark:text-dark-500" />
              <button 
                onClick={() => { setSelectedConstituency(null); setSelectedArea(null); setSelectedWard(null); }}
                className={`filter-tab ${selectedDistrict && !selectedConstituency ? 'active' : ''}`}
              >
                {t('label.constituencies')}
              </button>
            </>
          )}
          
          {selectedConstituency && (
            <>
              {isMLA && constituencies.length > 0 && (
                <span className="filter-tab text-saffron-600 dark:text-saffron-400 font-bold">
                  {constituencies[0]?.name}
                </span>
              )}
              {!isMLA && <ChevronRight className="w-4 h-4 text-dark-300 dark:text-dark-500" />}
              <button 
                onClick={() => { setSelectedArea(null); setSelectedWard(null); }}
                className={`filter-tab ${selectedConstituency && !selectedArea ? 'active' : ''}`}
              >
                {t('label.areas')}
              </button>
            </>
          )}

          {selectedArea && (
            <>
              <ChevronRight className="w-4 h-4 text-dark-300 dark:text-dark-500" />
              <button 
                onClick={() => setSelectedWard(null)}
                className={`filter-tab ${selectedArea && !selectedWard ? 'active' : ''}`}
              >
                {t('label.wards')}
              </button>
            </>
          )}
          
          {selectedWard && (
            <>
              <ChevronRight className="w-4 h-4 text-dark-300 dark:text-dark-500" />
              <span className="filter-tab active font-bold">{t('label.booths')}</span>
            </>
          )}
        </div>

        {/* Level content */}
        {!selectedState ? (
          // States
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">{t('label.states')} <span className="text-dark-500 font-normal">({states.length})</span></h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {states.map(state => (
                <div key={state.id} className="glass-card-hover p-6 cursor-pointer group relative">
                  <div onClick={() => setSelectedState(state.id)} className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-saffron-500/10 dark:bg-saffron-500/20 rounded-lg flex items-center justify-center">
                      <MapPin className="w-6 h-6 text-saffron-600 dark:text-saffron-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-dark-900 dark:text-dark-100 group-hover:text-saffron-500 transition-colors mb-0">{state.name}</h3>
                      <p className="text-sm text-dark-500 mt-0.5">{t('label.state_code')}: {state.code}</p>
                    </div>
                  </div>
                  <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isSuper && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); openEdit('state', state); }} className="w-7 h-7 rounded-md bg-dark-50 dark:bg-white/5 border border-dark-100 dark:border-white/10 flex items-center justify-center text-dark-600 dark:text-dark-400 hover:text-saffron-500"><Edit3 size={14}/></button>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteState(state.id); }} className="w-7 h-7 rounded-md bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500"><Trash2 size={14}/></button>
                      </>
                    )}
                    <ChevronRight onClick={() => setSelectedState(state.id)} className="w-7 h-7 text-dark-400 group-hover:text-saffron-500" />
                  </div>
                </div>
              ))}
              {states.length === 0 && (
                <div className="col-span-full text-center py-16 glass-card">
                  <MapPin className="w-12 h-12 text-dark-700 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-dark-300">{t('const.no_states')}</h3>
                  <p className="text-dark-500 text-sm mt-1">{t('const.no_states_desc')}</p>
                </div>
              )}
            </div>
          </div>
        ) : selectedState && !selectedDistrict ? (
          // Districts
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">{t('label.districts')} <span className="text-dark-500 font-normal">({districts.length})</span></h2>
              {isSuper && (
                <button onClick={() => openCreate('district')} className="btn-primary py-2 px-4 text-xs">
                  <Plus className="w-4 h-4" /> {t('label.add_district')}
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {districts.map(d => (
                <div key={d.id} className="glass-card-hover p-5 cursor-pointer group relative">
                  <div onClick={() => setSelectedDistrict(d.id)} className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-500/10 dark:bg-blue-500/20 rounded-lg flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-sm font-black text-dark-900 dark:text-dark-100 group-hover:text-saffron-500 transition-colors mb-0">{d.name}</h3>
                  </div>
                  <div className="absolute top-1/2 -translate-y-1/2 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isSuper && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); openEdit('district', d); }} className="w-7 h-7 rounded-md bg-dark-50 dark:bg-white/5 border border-dark-100 dark:border-white/10 flex items-center justify-center text-dark-600 dark:text-dark-400 hover:text-saffron-500"><Edit3 size={14}/></button>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteDistrict(d.id); }} className="w-7 h-7 rounded-md bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500"><Trash2 size={14}/></button>
                      </>
                    )}
                    <ChevronRight onClick={() => setSelectedDistrict(d.id)} className="w-7 h-7 text-dark-400 group-hover:text-saffron-500" />
                  </div>
                </div>
              ))}
              {districts.length === 0 && (
                <div className="col-span-full text-center py-12 text-dark-500 glass-card">{t('const.no_districts')}</div>
              )}
            </div>
          </div>
        ) : selectedDistrict && !selectedConstituency ? (
          // Constituencies
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">{t('label.constituencies')} <span className="text-dark-500 font-normal">({constituencies.length})</span></h2>
              {isSuper && (
                <button onClick={() => openCreate('constituency')} className="btn-primary py-2 px-4 text-xs">
                  <Plus className="w-4 h-4" /> {t('label.add_constituency')}
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {constituencies.map(c => (
                <div key={c.id} className="glass-card-hover p-6 cursor-pointer group relative">
                  <div onClick={() => setSelectedConstituency(c.id)} className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-black text-dark-900 dark:text-dark-100 group-hover:text-saffron-500 transition-colors mb-0">{c.name}</h3>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-dark-500 mt-1">{t('label.id')}: {c.number} • {t('label.mla_name')}: {c.mla_name || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="absolute top-1/2 -translate-y-1/2 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isSuper && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); openEdit('constituency', c); }} className="w-7 h-7 rounded-md bg-dark-50 dark:bg-white/5 border border-dark-100 dark:border-white/10 flex items-center justify-center text-dark-600 dark:text-dark-400 hover:text-saffron-500"><Edit3 size={14}/></button>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteConstituency(c.id); }} className="w-7 h-7 rounded-md bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500"><Trash2 size={14}/></button>
                      </>
                    )}
                    <ChevronRight onClick={() => setSelectedConstituency(c.id)} className="w-7 h-7 text-dark-400 group-hover:text-saffron-500" />
                  </div>
                </div>
              ))}
              {constituencies.length === 0 && (
                <div className="col-span-full text-center py-12 text-dark-500 glass-card">{t('const.no_constituencies')}</div>
              )}
            </div>
          </div>
        ) : selectedConstituency && !selectedArea ? (
          // Areas
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">{t('label.areas')} <span className="text-dark-500 font-normal">({areas.length})</span></h2>
              {canManageHierarchy && (
                <button onClick={() => openCreate('area')} className="btn-primary py-2 px-4 text-xs">
                  <Plus className="w-4 h-4" /> {t('label.add_area')}
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {areas.map(a => (
                <div key={a.id} className="glass-card-hover p-6 cursor-pointer group relative">
                  <div onClick={() => setSelectedArea(a.id)}>
                    <h3 className="text-base font-black text-dark-900 dark:text-dark-100 group-hover:text-saffron-500 transition-colors mb-0">{a.name}</h3>
                    <div className="mt-2 flex items-center gap-2 text-dark-500">
                      <Users className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-bold uppercase tracking-wider">{a.manager_name || t('const.unassigned_manager')}</span>
                    </div>
                  </div>
                  <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {canManageHierarchy && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); openEdit('area', a); }} className="w-7 h-7 rounded-md bg-dark-50 dark:bg-white/5 border border-dark-100 dark:border-white/10 flex items-center justify-center text-dark-600 dark:text-dark-400 hover:text-saffron-500"><Edit3 size={14}/></button>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteArea(a.id); }} className="w-7 h-7 rounded-md bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500"><Trash2 size={14}/></button>
                      </>
                    )}
                    <ChevronRight onClick={() => setSelectedArea(a.id)} className="w-7 h-7 text-dark-400 group-hover:text-saffron-500" />
                  </div>
                </div>
              ))}
              {areas.length === 0 && (
                <div className="col-span-full text-center py-12 text-dark-500 glass-card">{t('const.no_areas')}</div>
              )}
            </div>
          </div>
        ) : selectedArea && !selectedWard ? (
          // Wards
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">{t('label.wards')} <span className="text-dark-500 font-normal">({wards.length})</span></h2>
              {canManageHierarchy && (
                <button onClick={() => openCreate('ward')} className="btn-primary py-2 px-4 text-xs">
                  <Plus className="w-4 h-4" /> {t('label.add_ward')}
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {wards.map(w => (
                <div key={w.id} className="glass-card-hover p-5 cursor-pointer group relative">
                  <div onClick={() => setSelectedWard(w.id)} className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-green-500/10 dark:bg-green-500/20 rounded-lg flex items-center justify-center text-green-700 dark:text-green-400 font-bold text-xs shadow-inner">
                      {w.number}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[14px] font-bold text-dark-900 dark:text-dark-100 group-hover:text-saffron-600 dark:group-hover:text-saffron-400 transition-colors uppercase tracking-tight">{w.name}</span>
                      <span className="text-[10px] text-dark-500 font-bold uppercase tracking-widest mt-0.5">{t('role.ward_head')}: {w.ward_head_name || t('const.unassigned')}</span>
                    </div>
                  </div>
                  <div className="absolute top-1/2 -translate-y-1/2 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {canManageHierarchy && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); openEdit('ward', w); }} className="w-7 h-7 rounded-md bg-dark-50 dark:bg-white/5 border border-dark-100 dark:border-white/10 flex items-center justify-center text-dark-600 dark:text-dark-400 hover:text-saffron-500"><Edit3 size={14}/></button>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteWard(w.id); }} className="w-7 h-7 rounded-md bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500"><Trash2 size={14}/></button>
                      </>
                    )}
                    <ChevronRight onClick={() => setSelectedWard(w.id)} className="w-7 h-7 text-dark-400 group-hover:text-saffron-500" />
                  </div>
                </div>
              ))}
              {wards.length === 0 && (
                <div className="col-span-full text-center py-12 text-dark-500 glass-card">{t('const.no_wards')}</div>
              )}
            </div>
          </div>
        ) : (
          // Booths
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">{t('label.booths')} <span className="text-dark-500 font-normal">({booths.length})</span></h2>
              {canManageHierarchy && (
                <button onClick={() => openCreate('booth')} className="btn-primary py-2 px-4 text-xs">
                  <Plus className="w-4 h-4" /> {t('label.add_booth')}
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {booths.map(b => (
                <div key={b.id} className="glass-card-hover p-5 font-inter group relative">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-amber-500/10 dark:bg-amber-500/20 rounded-lg flex items-center justify-center text-amber-700 dark:text-amber-400 font-bold text-[10px] text-center">
                      {b.number}
                    </div>
                    <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-dark-900 dark:text-dark-100 mb-0">{b.name}</h4>
                  </div>
                  {b.address && <p className="text-[13px] text-dark-500 flex items-start gap-2 leading-relaxed"><Home className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-dark-400" />{b.address}</p>}
                  
                  {canManageHierarchy && (
                    <div className="absolute bottom-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit('booth', b)} className="w-7 h-7 rounded-md bg-dark-50 dark:bg-white/5 border border-dark-100 dark:border-white/10 flex items-center justify-center text-dark-600 dark:text-dark-400 hover:text-saffron-500"><Edit3 size={14}/></button>
                      <button onClick={() => handleDeleteBooth(b.id)} className="w-7 h-7 rounded-md bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500"><Trash2 size={14}/></button>
                    </div>
                  )}
                </div>
              ))}
              {booths.length === 0 && (
                <div className="col-span-full text-center py-12 text-dark-500 glass-card">{t('const.no_booths')}</div>
              )}
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={showStructureModal}
        onClose={() => setShowStructureModal(false)}
        title={t('const.modal.create_structure')}
        subtitle={t('const.modal.create_structure_sub')}
        maxWidth="max-w-[700px]"
        footer={(
          <div className="flex justify-between w-full">
            <button 
              type="button" 
              onClick={() => { if (currentStep > 1) setCurrentStep(v => v - 1); }} 
              disabled={currentStep === 1}
              className="btn-secondary px-8"
            >
              {t('action.back')}
            </button>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowStructureModal(false)} className="px-6 text-sm font-bold text-dark-500">{t('action.cancel')}</button>
              {currentStep < 6 ? (
                <button 
                  type="button" 
                  onClick={() => setCurrentStep(v => v + 1)} 
                  className="btn-primary px-10"
                >
                  {t('label.next_step')}
                </button>
              ) : (
                <button 
                  type="submit" 
                  form="structure-form" 
                  className="btn-primary px-10 bg-green-600 hover:bg-green-700 shadow-xl shadow-green-500/20"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('label.finish_create')}
                </button>
              )}
            </div>
          </div>
        )}
      >
        <div className="mb-8">
          {/* Progress Indicator */}
          <div className="flex items-center justify-between mb-2">
            {[1, 2, 3, 4, 5, 6].map(step => (
              <div key={step} className="flex items-center flex-1 last:flex-none">
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                    currentStep === step ? 'bg-saffron-500 text-white ring-4 ring-saffron-500/20 scale-110' : 
                    currentStep > step ? 'bg-green-500 text-white' : 'bg-dark-100 dark:bg-white/5 text-dark-500'
                  }`}
                >
                  {currentStep > step ? '✓' : step}
                </div>
                {step < 6 && (
                  <div className={`h-1 flex-1 mx-2 rounded-full transition-all duration-500 ${currentStep > step ? 'bg-green-500' : 'bg-dark-100 dark:bg-white/5'}`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between px-1">
            <span className="text-[10px] font-bold text-dark-400 uppercase tracking-widest">{t('label.state')}</span>
            <span className="text-[10px] font-bold text-dark-400 uppercase tracking-widest">{t('label.district')}</span>
            <span className="text-[10px] font-bold text-dark-400 uppercase tracking-widest">{t('label.constituency')}</span>
            <span className="text-[10px] font-bold text-dark-400 uppercase tracking-widest">{t('label.area')}</span>
            <span className="text-[10px] font-bold text-dark-400 uppercase tracking-widest">{t('label.ward')}</span>
            <span className="text-[10px] font-bold text-dark-400 uppercase tracking-widest">{t('label.booth')}</span>
          </div>
        </div>

        <form id="structure-form" onSubmit={handleStructureSubmit} className="space-y-6 py-2">
          {currentStep === 1 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-saffron-500/5 p-4 rounded-xl border border-saffron-500/10 flex items-center gap-4 mb-2">
                <MapPin className="text-saffron-500 w-8 h-8" />
                <div>
                  <h4 className="text-sm font-bold text-dark-900 dark:text-dark-100">{t('const.step_title').replace('{step}', '1').replace('{name}', t('label.state'))}</h4>
                  <p className="text-xs text-dark-500 italic">{t('const.step1_sub')}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setStructureForm({...structureForm, state: {...structureForm.state, mode: 'select'}})} 
                  className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all ${structureForm.state.mode === 'select' ? 'border-saffron-500 bg-saffron-500/10' : 'border-dark-100 dark:border-white/5 bg-transparent'}`}>
                  {t('label.select_existing')}
                </button>
                <button type="button" onClick={() => setStructureForm({...structureForm, state: {...structureForm.state, mode: 'create'}})} 
                  className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all ${structureForm.state.mode === 'create' ? 'border-saffron-500 bg-saffron-500/10' : 'border-dark-100 dark:border-white/5 bg-transparent'}`}>
                  {t('label.create_new')}
                </button>
              </div>
              {structureForm.state.mode === 'select' ? (
                <select 
                  value={structureForm.state.id} 
                  onChange={e => {
                    const id = e.target.value;
                    setStructureForm({...structureForm, state: {...structureForm.state, id}});
                    if (id) constituencyAPI.getDistricts(parseInt(id)).then(res => setDistricts(res.data.data));
                  }} 
                  className="form-input text-base py-3" required
                >
                  <option value="">{t('label.choose_state')}</option>
                  {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-dark-400 px-1">{t('label.state_name')}</label>
                    <input value={structureForm.state.name} onChange={e => setStructureForm({...structureForm, state: {...structureForm.state, name: e.target.value}})} className="form-input" placeholder="Maharashtra" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-dark-400 px-1">{t('label.state_code')}</label>
                    <input value={structureForm.state.code} onChange={e => setStructureForm({...structureForm, state: {...structureForm.state, code: e.target.value.toUpperCase()}})} className="form-input uppercase" placeholder="MH" required />
                  </div>
                </div>
              )}
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-blue-500/5 p-4 rounded-xl border border-blue-500/10 flex items-center gap-4 mb-2">
                <Building2 className="text-blue-500 w-8 h-8" />
                <div>
                  <h4 className="text-sm font-bold text-dark-900 dark:text-dark-100">{t('const.step_title').replace('{step}', '2').replace('{name}', t('label.district'))}</h4>
                  <p className="text-xs text-dark-500">{t('const.step2_sub').replace('{state}', structureForm.state.name || '')}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setStructureForm({...structureForm, district: {...structureForm.district, mode: 'select'}})} 
                  className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all ${structureForm.district.mode === 'select' ? 'border-saffron-500 bg-saffron-500/10' : 'border-dark-100 dark:border-white/5 bg-transparent'}`}>
                  {t('label.select_existing')}
                </button>
                <button type="button" onClick={() => setStructureForm({...structureForm, district: {...structureForm.district, mode: 'create'}})} 
                  className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all ${structureForm.district.mode === 'create' ? 'border-saffron-500 bg-saffron-500/10' : 'border-dark-100 dark:border-white/5 bg-transparent'}`}>
                  {t('label.create_new')}
                </button>
              </div>
              {structureForm.district.mode === 'select' ? (
                <select 
                  value={structureForm.district.id} 
                  onChange={e => {
                    const id = e.target.value;
                    setStructureForm({...structureForm, district: {...structureForm.district, id}});
                    if (id) constituencyAPI.getConstituencies(parseInt(id)).then(res => setConstituencies(res.data.data));
                  }} 
                  className="form-input text-base py-3" required
                >
                  <option value="">{t('label.choose_district')}</option>
                  {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              ) : (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-dark-400 px-1">{t('label.district_name')}</label>
                  <input value={structureForm.district.name} onChange={e => setStructureForm({...structureForm, district: {...structureForm.district, name: e.target.value}})} className="form-input" placeholder="Pune" required />
                </div>
              )}
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-indigo-500/5 p-4 rounded-xl border border-indigo-500/10 flex items-center gap-4 mb-2">
                <MapPin className="text-indigo-500 w-8 h-8" />
                <div>
                  <h4 className="text-sm font-bold text-dark-900 dark:text-dark-100">{t('const.step_title').replace('{step}', '3').replace('{name}', t('label.constituency'))}</h4>
                  <p className="text-xs text-dark-500">{t('const.step3_sub')}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setStructureForm({...structureForm, constituency: {...structureForm.constituency, mode: 'select'}})} 
                  className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all ${structureForm.constituency.mode === 'select' ? 'border-saffron-500 bg-saffron-500/10' : 'border-dark-100 dark:border-white/5 bg-transparent'}`}>
                  {t('label.select_existing')}
                </button>
                <button type="button" onClick={() => setStructureForm({...structureForm, constituency: {...structureForm.constituency, mode: 'create'}})} 
                  className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all ${structureForm.constituency.mode === 'create' ? 'border-saffron-500 bg-saffron-500/10' : 'border-dark-100 dark:border-white/5 bg-transparent'}`}>
                  {t('label.create_new')}
                </button>
              </div>
              {structureForm.constituency.mode === 'select' ? (
                <select 
                  value={structureForm.constituency.id} 
                  onChange={e => {
                    const id = e.target.value;
                    setStructureForm({...structureForm, constituency: {...structureForm.constituency, id}});
                  }} 
                  className="form-input text-base py-3" required
                >
                  <option value="">{t('label.choose_constituency')}</option>
                  {constituencies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-dark-400 px-1">{t('label.constituency_name')}</label>
                    <input value={structureForm.constituency.name} onChange={e => setStructureForm({...structureForm, constituency: {...structureForm.constituency, name: e.target.value}})} className="form-input" placeholder="Baramati" required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase text-dark-400 px-1">{t('label.id')}</label>
                      <input value={structureForm.constituency.number} onChange={e => setStructureForm({...structureForm, constituency: {...structureForm.constituency, number: e.target.value}})} className="form-input" placeholder="201" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase text-dark-400 px-1">{t('label.mla_name')}</label>
                      <input value={structureForm.constituency.mla_name} onChange={e => setStructureForm({...structureForm, constituency: {...structureForm.constituency, mla_name: e.target.value}})} className="form-input" placeholder="Name..." />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-purple-500/5 p-4 rounded-xl border border-purple-500/10 flex items-center gap-4 mb-2">
                <Users className="text-purple-500 w-8 h-8" />
                <div>
                  <h4 className="text-sm font-bold text-dark-900 dark:text-dark-100">{t('const.step_title').replace('{step}', '4').replace('{name}', t('label.area'))}</h4>
                  <p className="text-xs text-dark-500">{t('const.step4_sub')}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-dark-400 px-1">{t('label.area_name')}</label>
                  <input value={structureForm.area.name} onChange={e => setStructureForm({...structureForm, area: {...structureForm.area, name: e.target.value}})} className="form-input" placeholder="Civil Lines" required />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-dark-400 px-1">{t('role.campaign_manager')}</label>
                  <select value={structureForm.area.manager_id} onChange={e => setStructureForm({...structureForm, area: {...structureForm.area, manager_id: e.target.value}})} className="form-input">
                    <option value="">{t('const.unassigned')}</option>
                    {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-green-500/5 p-4 rounded-xl border border-green-500/10 flex items-center gap-4 mb-2">
                <Building2 className="text-green-500 w-8 h-8" />
                <div>
                  <h4 className="text-sm font-bold text-dark-900 dark:text-dark-100">{t('const.step_title').replace('{step}', '5').replace('{name}', t('label.ward'))}</h4>
                  <p className="text-xs text-dark-500">{t('const.step5_sub')}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-2">
                    <label className="text-[10px] font-bold uppercase text-dark-400 px-1">{t('label.ward_name')}</label>
                    <input value={structureForm.ward.name} onChange={e => setStructureForm({...structureForm, ward: {...structureForm.ward, name: e.target.value}})} className="form-input" placeholder="Ward No. 1" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-dark-400 px-1">{t('label.ward_number')}</label>
                    <input value={structureForm.ward.number} onChange={e => setStructureForm({...structureForm, ward: {...structureForm.ward, number: e.target.value}})} className="form-input" placeholder="01" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-dark-400 px-1">{t('role.ward_head')}</label>
                  <select value={structureForm.ward.ward_head_id} onChange={e => setStructureForm({...structureForm, ward: {...structureForm.ward, ward_head_id: e.target.value}})} className="form-input">
                    <option value="">{t('const.unassigned')}</option>
                    {wardHeads.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {currentStep === 6 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-orange-500/5 p-4 rounded-xl border border-orange-500/10 flex items-center gap-4 mb-2">
                <Home className="text-orange-500 w-8 h-8" />
                <div>
                  <h4 className="text-sm font-bold text-dark-900 dark:text-dark-100">{t('const.step_title').replace('{step}', '6').replace('{name}', t('label.booth'))}</h4>
                  <p className="text-xs text-dark-500">{t('const.step6_sub')}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-2">
                    <label className="text-[10px] font-bold uppercase text-dark-400 px-1">{t('label.booth_name')}</label>
                    <input value={structureForm.booth.name} onChange={e => setStructureForm({...structureForm, booth: {...structureForm.booth, name: e.target.value}})} className="form-input" placeholder="Local High School" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-dark-400 px-1">{t('label.booth_number')}</label>
                    <input value={structureForm.booth.number} onChange={e => setStructureForm({...structureForm, booth: {...structureForm.booth, number: e.target.value}})} className="form-input" placeholder="102" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-dark-400 px-1">{t('label.address')}</label>
                  <textarea value={structureForm.booth.address} onChange={e => setStructureForm({...structureForm, booth: {...structureForm.booth, address: e.target.value}})} className="form-input h-24 resize-none" placeholder="Detailed location..." />
                </div>
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* Single Unit Management Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={getModalTitle()}
        subtitle={getModalSubtitle()}
        maxWidth="max-w-[500px]"
        footer={(
          <>
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">{t('action.cancel')}</button>
            <button type="submit" form="geo-form" className="btn-primary min-w-[120px]">
              {editingItem ? t('action.save') : t('const.modal.create_unit')}
            </button>
          </>
        )}
      >
        <form id="geo-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">{t('label.name')}</label>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="form-input" placeholder="" required />
          </div>

          {modalType === 'state' && (
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">{t('label.state_code')}</label>
              <input value={form.code} onChange={e => setForm({...form, code: e.target.value.toUpperCase()})} className="form-input" placeholder="e.g. MH, UP, KA" required maxLength={5} />
            </div>
          )}

          {(modalType === 'constituency' || modalType === 'ward' || modalType === 'booth') && (
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">{t('label.id')}</label>
              <input value={form.number} onChange={e => setForm({...form, number: e.target.value})} className="form-input" placeholder="e.g. 05" required />
            </div>
          )}

          {modalType === 'constituency' && (
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">{t('label.mla_name_label')}</label>
              <input value={form.mla_name} onChange={e => setForm({...form, mla_name: e.target.value})} className="form-input" placeholder="" />
            </div>
          )}

          {modalType === 'area' && (
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">{t('role.campaign_manager')}</label>
              <select value={form.manager_id} onChange={e => setForm({...form, manager_id: e.target.value})} className="form-input">
                <option value="">{t('const.unassigned')}</option>
                {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          )}

          {modalType === 'ward' && (
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">{t('role.ward_head')}</label>
              <select value={form.ward_head_id} onChange={e => setForm({...form, ward_head_id: e.target.value})} className="form-input">
                <option value="">{t('const.unassigned')}</option>
                {wardHeads.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          )}

          {modalType === 'booth' && (
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-400 uppercase tracking-widest px-1">{t('label.address')}</label>
              <textarea value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="form-input h-20 resize-none" placeholder="" />
            </div>
          )}
        </form>
      </Modal>
    </>
  );
}
