'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { constituencyAPI } from '@/lib/api';
import { State, District, Constituency, Ward, Booth } from '@/types';
import { Plus, X, Loader2, MapPin, ChevronRight, Building2, Home } from 'lucide-react';

export default function ConstituencyPage() {
  const [states, setStates] = useState<State[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [constituencies, setConstituencies] = useState<Constituency[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [booths, setBooths] = useState<Booth[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedState, setSelectedState] = useState<number | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<number | null>(null);
  const [selectedConstituency, setSelectedConstituency] = useState<number | null>(null);
  const [selectedWard, setSelectedWard] = useState<number | null>(null);

  useEffect(() => { loadInitial(); }, []);

  const loadInitial = async () => {
    try {
      const [statesRes, constituenciesRes] = await Promise.all([
        constituencyAPI.getStates(),
        constituencyAPI.getConstituencies(),
      ]);
      setStates(statesRes.data.data);
      setConstituencies(constituenciesRes.data.data);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => {
    if (selectedState) {
      constituencyAPI.getDistricts(selectedState).then(res => setDistricts(res.data.data));
    }
  }, [selectedState]);

  useEffect(() => {
    if (selectedDistrict) {
      constituencyAPI.getConstituencies(selectedDistrict).then(res => setConstituencies(res.data.data));
    }
  }, [selectedDistrict]);

  useEffect(() => {
    if (selectedConstituency) {
      constituencyAPI.getWards(selectedConstituency).then(res => setWards(res.data.data));
    }
  }, [selectedConstituency]);

  useEffect(() => {
    if (selectedWard) {
      constituencyAPI.getBooths(selectedWard).then(res => setBooths(res.data.data));
    }
  }, [selectedWard]);

  if (loading) return (
    <>
      <Header title="Constituency Structure" subtitle="Geographical hierarchy management" />
      <div className="p-8 flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-saffron-400" /></div>
    </>
  );

  return (
    <>
      <Header title="Constituency Structure" subtitle="State → District → Constituency → Ward → Booth" />
      <div className="p-8">
        {/* Breadcrumb / Selection Flow */}
        <div className="flex items-center gap-2 mb-8 text-sm flex-wrap p-1 rounded-xl bg-dark-50/50 dark:bg-white/[0.02] border border-dark-100 dark:border-white/5">
          <button 
            onClick={() => { setSelectedState(null); setSelectedDistrict(null); setSelectedConstituency(null); setSelectedWard(null); }}
            className={`filter-tab ${!selectedState ? 'active' : ''}`}
          >
            States
          </button>
          
          {selectedState && (
            <>
              <ChevronRight className="w-4 h-4 text-dark-300 dark:text-dark-500" />
              <button 
                onClick={() => { setSelectedDistrict(null); setSelectedConstituency(null); setSelectedWard(null); }}
                className={`filter-tab ${selectedState && !selectedDistrict ? 'active' : ''}`}
              >
                Districts
              </button>
            </>
          )}
          
          {selectedDistrict && (
            <>
              <ChevronRight className="w-4 h-4 text-dark-300 dark:text-dark-500" />
              <button 
                onClick={() => { setSelectedConstituency(null); setSelectedWard(null); }}
                className={`filter-tab ${selectedDistrict && !selectedConstituency ? 'active' : ''}`}
              >
                Constituencies
              </button>
            </>
          )}
          
          {selectedConstituency && (
            <>
              <ChevronRight className="w-4 h-4 text-dark-300 dark:text-dark-500" />
              <button 
                onClick={() => setSelectedWard(null)}
                className={`filter-tab ${selectedConstituency && !selectedWard ? 'active' : ''}`}
              >
                Wards
              </button>
            </>
          )}
          
          {selectedWard && (
            <>
              <ChevronRight className="w-4 h-4 text-dark-300 dark:text-dark-500" />
              <span className="filter-tab active font-bold">Booths</span>
            </>
          )}
        </div>

        {/* Level content */}
        {!selectedState ? (
          // States
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {states.map(state => (
              <div key={state.id} onClick={() => setSelectedState(state.id)}
                className="glass-card-hover p-6 cursor-pointer group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-saffron-500/10 dark:bg-saffron-500/20 rounded-lg flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-saffron-600 dark:text-saffron-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-dark-900 dark:text-dark-100 group-hover:text-saffron-500 transition-colors mb-0">{state.name}</h3>
                    <p className="text-sm text-dark-500 mt-0.5">Code: {state.code}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-dark-600 ml-auto group-hover:text-saffron-400 transition-colors" />
                </div>
              </div>
            ))}
            {states.length === 0 && (
              <div className="col-span-full text-center py-16 glass-card">
                <MapPin className="w-12 h-12 text-dark-700 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-dark-300">No states added</h3>
                <p className="text-dark-500 text-sm mt-1">Run the seed script to add sample data</p>
              </div>
            )}
          </div>
        ) : selectedState && !selectedDistrict ? (
          // Districts
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {districts.map(d => (
              <div key={d.id} onClick={() => setSelectedDistrict(d.id)}
                className="glass-card-hover p-5 cursor-pointer group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-500/10 dark:bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-sm font-black text-dark-900 dark:text-dark-100 group-hover:text-saffron-500 transition-colors mb-0">{d.name}</h3>
                  <ChevronRight className="w-5 h-5 text-dark-400 ml-auto group-hover:text-saffron-600 dark:group-hover:text-saffron-400 transition-colors" />
                </div>
              </div>
            ))}
          </div>
        ) : selectedDistrict && !selectedConstituency ? (
          // Constituencies
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {constituencies.map(c => (
              <div key={c.id} onClick={() => setSelectedConstituency(c.id)}
                className="glass-card-hover p-6 cursor-pointer group">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-black text-dark-900 dark:text-dark-100 group-hover:text-saffron-500 transition-colors mb-0">{c.name}</h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-dark-500 mt-1">No. {c.number} • MLA: {c.mla_name || 'N/A'}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-dark-400 group-hover:text-saffron-600 dark:group-hover:text-saffron-400 transition-colors" />
                </div>
              </div>
            ))}
          </div>
        ) : selectedConstituency && !selectedWard ? (
          // Wards
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {wards.map(w => (
              <div key={w.id} onClick={() => setSelectedWard(w.id)}
                className="glass-card-hover p-5 cursor-pointer group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-500/10 dark:bg-green-500/20 rounded-lg flex items-center justify-center text-green-700 dark:text-green-400 font-bold text-[10px]">
                    {w.number}
                  </div>
                  <span className="text-[14px] font-bold text-dark-900 dark:text-dark-100 group-hover:text-saffron-600 dark:group-hover:text-saffron-400 transition-colors uppercase tracking-tight">{w.name}</span>
                  <ChevronRight className="w-4 h-4 text-dark-400 ml-auto group-hover:text-saffron-600 dark:group-hover:text-saffron-400 transition-colors" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Booths
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {booths.map(b => (
              <div key={b.id} className="glass-card-hover p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-amber-500/10 dark:bg-amber-500/20 rounded-lg flex items-center justify-center text-amber-700 dark:text-amber-400 font-bold text-[10px] text-center">
                    {b.number}
                  </div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-dark-900 dark:text-dark-100 mb-0">{b.name}</h4>
                </div>
                {b.address && <p className="text-sm text-dark-500 flex items-start gap-2"><Home className="w-4 h-4 flex-shrink-0 mt-0.5" />{b.address}</p>}
              </div>
            ))}
            {booths.length === 0 && (
              <div className="col-span-full text-center py-12 text-dark-500">No booths in this ward</div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
