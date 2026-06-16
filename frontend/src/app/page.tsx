'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import {
  Shield,
  BarChart3,
  Users,
  Target,
  Zap,
  Lock,
  ArrowRight,
  ChevronRight,
  Globe,
  Database,
  PieChart,
  MessageSquare,
  Sun,
  Moon,
  CheckCircle2,
  TrendingUp,
  Layout
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import LoginModal from '@/components/auth/LoginModal';

export default function Home() {
  const { user, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Prevent flash of content if user is logged in
  if (!mounted || (loading && !user)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-dark-950">
        <div className="w-12 h-12 border-4 border-dark-100 dark:border-dark-800 border-t-saffron-500 rounded-full animate-spin" />
      </div>
    );
  }

  // If user is logged in, show nothing (useEffect will redirect)
  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-dark-950">
        <div className="w-12 h-12 border-4 border-dark-100 dark:border-dark-800 border-t-saffron-500 rounded-full animate-spin" />
      </div>
    );
  }

  const features = [
    {
      title: t('landing.feat.camp_intel', "Campaign Intelligence"),
      description: t('landing.feat.camp_intel_desc', "AI-driven insights to optimize your campaign strategy and resources."),
      icon: <Zap className="w-6 h-6 text-saffron-500" />,
    },
    {
      title: t('landing.feat.voter_anal', "Voter Analytics"),
      description: t('landing.feat.voter_anal_desc', "Deep dive into constituency demographics and sentiment analysis."),
      icon: <BarChart3 className="w-6 h-6 text-saffron-500" />,
    },
    {
      title: t('landing.feat.vol_mgr', "Volunteer Management"),
      description: t('landing.feat.vol_mgr_desc', "Coordinate thousands of ground workers with automated task tracking."),
      icon: <Users className="w-6 h-6 text-saffron-500" />,
    },
    {
      title: t('landing.feat.booth_ops', "Booth Operations"),
      description: t('landing.feat.booth_ops_desc', "Smart booth-level data management and real-time polling reports."),
      icon: <Target className="w-6 h-6 text-saffron-500" />,
    },
    {
      title: t('landing.feat.dig_outreach', "Digital Outreach"),
      description: t('landing.feat.dig_outreach_desc', "Integrated communication tools for direct voter engagement."),
      icon: <Globe className="w-6 h-6 text-saffron-500" />,
    },
    {
      title: t('landing.feat.ent_sec', "Enterprise Security"),
      description: t('landing.feat.ent_sec_desc', "Military-grade encryption for all candidate and election data."),
      icon: <Lock className="w-6 h-6 text-saffron-500" />,
    }
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-dark-950 text-dark-900 dark:text-white selection:bg-saffron-500/10 selection:text-saffron-700 transition-colors duration-300">
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />

      {/* Background patterns */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute w-[800px] h-[800px] -top-[300px] -left-[200px] bg-saffron-500/[0.05] dark:bg-saffron-500/[0.04] rounded-full blur-[120px] animate-pulse" />
        <div className="absolute w-[600px] h-[600px] -bottom-[200px] -right-[100px] bg-blue-500/[0.04] dark:bg-blue-500/[0.03] rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02] dark:opacity-[0.03] mix-blend-overlay" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-dark-100 dark:border-white/[0.05] bg-white/70 dark:bg-dark-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-saffron-500 to-saffron-700 rounded-lg flex items-center justify-center glow-saffron shadow-lg shadow-saffron-500/20">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-extrabold text-xl tracking-tight text-dark-900 dark:text-white">
              MLA<span className="text-saffron-500">.</span>EMS
            </span>
          </div>

          <div className="flex items-center gap-2 lg:gap-4">
            {/* Language Switcher Dropdown */}
            <div className="relative" ref={langRef}>
              <button
                onClick={() => setLangOpen(!langOpen)}
                className="w-10 h-8 rounded-lg bg-dark-50/80 dark:bg-dark-800/30 border border-dark-200/50 dark:border-white/[0.06] text-dark-500 dark:text-dark-400 flex items-center justify-center gap-1 hover:bg-dark-100 dark:hover:bg-dark-700/50 transition-all duration-200 text-xs font-bold"
                title="Switch Language / भाषा बदलें"
              >
                <Globe size={14} className="text-dark-400 dark:text-dark-500" />
                <span className="uppercase">{language}</span>
              </button>

              {langOpen && (
                <div className="absolute right-0 top-full mt-2 w-36 bg-white dark:bg-dark-900 rounded-lg border border-dark-200/60 dark:border-white/[0.06] shadow-2xl shadow-black/10 dark:shadow-black/40 p-1 animate-fade-in z-50">
                  <button
                    onClick={() => {
                      setLanguage('en');
                      setLangOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md transition-all duration-200 text-xs font-semibold ${
                      language === 'en'
                        ? 'bg-saffron-500/10 text-saffron-600 dark:text-saffron-400'
                        : 'text-dark-700 dark:text-dark-300 hover:bg-dark-50 dark:hover:bg-white/[0.03]'
                    }`}
                  >
                    <span>English</span>
                    {language === 'en' && <span className="w-1.5 h-1.5 rounded-full bg-saffron-500" />}
                  </button>
                  <button
                    onClick={() => {
                      setLanguage('hi');
                      setLangOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md transition-all duration-200 text-xs font-semibold ${
                      language === 'hi'
                        ? 'bg-saffron-500/10 text-saffron-600 dark:text-saffron-400'
                        : 'text-dark-700 dark:text-dark-300 hover:bg-dark-50 dark:hover:bg-white/[0.03]'
                    }`}
                  >
                    <span>हिन्दी</span>
                    {language === 'hi' && <span className="w-1.5 h-1.5 rounded-full bg-saffron-500" />}
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl bg-dark-50 dark:bg-white/[0.05] text-dark-600 dark:text-dark-400 hover:text-saffron-500 transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            <button
              onClick={() => setIsLoginOpen(true)}
              className="btn-primary flex items-center gap-2 h-9 px-5 shadow-xl shadow-saffron-500/10 rounded-lg text-sm"
            >
              {t('landing.login', 'Login')} <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </nav>

      <main className="relative z-10 pt-20">
        {/* Hero Section Redesign */}
        <section className="px-6 py-20 lg:py-32 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 text-left">
              <h1 className="text-5xl lg:text-7xl font-extrabold mb-8 tracking-tight leading-[1.1] animate-slide-up text-dark-900 dark:text-white">
                {t('landing.title', 'Election Management Redefined Digitally')}
              </h1>

              <p className="max-w-xl text-dark-500 dark:text-dark-400 text-lg lg:text-xl mb-12 animate-slide-up leading-relaxed" style={{ animationDelay: '0.1s' }}>
                {t('landing.subtitle', 'The mission-critical platform for MLA candidates. Orchestrate your entire visibility, volunteer network, and voter engagement from one sleek interface.')}
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-4 animate-slide-up" style={{ animationDelay: '0.2s' }}>
                <button
                  onClick={() => setIsLoginOpen(true)}
                  className="btn-primary w-full sm:w-auto px-10 h-14 text-base"
                >
                  {t('landing.get_started', 'Get Started Now')}
                </button>
              </div>

              {/* Quick stats / Highlights */}
              <div className="mt-16 grid grid-cols-3 gap-8 pt-12 border-t border-dark-100 dark:border-white/[0.05] animate-slide-up" style={{ animationDelay: '0.3s' }}>
                <div>
                  <div className="text-2xl font-black text-dark-900 dark:text-white mb-1">2,500+</div>
                  <div className="text-[10px] uppercase font-bold tracking-widest text-dark-400">{t('landing.volunteers_managed', 'Volunteers Managed')}</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-dark-900 dark:text-white mb-1">15+</div>
                  <div className="text-[10px] uppercase font-bold tracking-widest text-dark-400">{t('landing.constituencies_live', 'Constituencies Live')}</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-dark-900 dark:text-white mb-1">100%</div>
                  <div className="text-[10px] uppercase font-bold tracking-widest text-dark-400">{t('landing.data_encryption', 'Data Encryption')}</div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 relative animate-slide-up lg:translate-x-12" style={{ animationDelay: '0.3s' }}>
              <div className="relative group">
                {/* Decorative blobs */}
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-saffron-500/20 rounded-full blur-3xl animate-pulse" />
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

                <div className="relative glass-card p-3 rounded-[2.5rem] border-white/20 dark:border-white/10 shadow-2xl overflow-hidden">
                  <div className="aspect-[4/5] bg-dark-50 dark:bg-dark-900 rounded-[2rem] overflow-hidden relative border border-dark-100 dark:border-white/5">
                    {/* Hero Image Mockup - Improved visibility and better tech image */}
                    <Image
                      src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=2426&auto=format&fit=crop"
                      alt="MLA Dashboard"
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-cover group-hover:scale-110 transition-transform duration-1000 ease-in-out"
                      priority
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-dark-950/40 via-transparent to-transparent opacity-0 dark:opacity-100 pointer-events-none" />

                    {/* Client-side "Glass" layer */}
                    <div className="absolute inset-0 bg-saffron-500/5 mix-blend-overlay" />

                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Section */}
        <section className="px-6 py-32 bg-dark-50/30 dark:bg-dark-900/20 relative overflow-hidden transition-colors">
          <div className="max-w-7xl mx-auto">
            <div className="mb-20 text-center">
              <div className="text-saffron-600 dark:text-saffron-500 text-[10px] font-black uppercase tracking-[4px] mb-4">{t('landing.core_ecosystem', 'Core Ecosystem')}</div>
              <h2 className="text-3xl lg:text-5xl font-bold mb-6 text-dark-900 dark:text-white">{t('landing.built_for_stakes', 'Built for High-Stakes Politics')}</h2>
              <p className="text-dark-500 dark:text-dark-400 max-w-2xl mx-auto text-lg leading-relaxed">
                {t('landing.ecosystem_sub', 'Experience the first truly unified command center for election cycles, voter relationships, and field intelligence.')}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature, idx) => (
                <div
                  key={idx}
                  className="glass-card-hover p-10 flex flex-col items-start gap-8 border-dark-200/30 dark:border-white/[0.01] bg-white dark:bg-white/[0.01] hover:shadow-2xl hover:shadow-saffron-500/10"
                >
                  <div className="w-16 h-16 bg-dark-50 dark:bg-dark-800/80 rounded-[1.25rem] flex items-center justify-center border border-dark-100 dark:border-white/[0.05] shadow-sm transform group-hover:scale-110 transition-all duration-300">
                    {feature.icon}
                  </div>
                  <div>
                    <h3 className="text-xl font-extrabold mb-4 text-dark-900 dark:text-white tracking-tight">{feature.title}</h3>
                    <p className="text-dark-500 dark:text-dark-400 text-sm leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trusted Partners / Micro-logos */}
        <section className="py-20 border-y border-dark-100 dark:border-white/[0.05]">
          <div className="max-w-7xl mx-auto px-6">
            <p className="text-center text-dark-400 dark:text-dark-500 text-[10px] font-black uppercase tracking-[0.4em] mb-12">{t('landing.partners', 'Powering Leading Candidates Across India')}</p>
            <div className="flex flex-wrap justify-center gap-12 lg:gap-32 opacity-20 dark:opacity-30 grayscale hover:grayscale-0 transition-all duration-500">
              <div className="flex items-center gap-3"><Layout className="w-6 h-6" /><span className="font-bold text-lg">Electorate</span></div>
              <div className="flex items-center gap-3"><Globe className="w-6 h-6" /><span className="font-bold text-lg">ConstituencyHub</span></div>
              <div className="flex items-center gap-3"><CheckCircle2 className="w-6 h-6" /><span className="font-bold text-lg">VoteReady</span></div>
              <div className="flex items-center gap-3"><Shield className="w-6 h-6" /><span className="font-bold text-lg">CampaignSecure</span></div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="px-6 py-32 max-w-7xl mx-auto">
          <div className="relative rounded-[3rem] overflow-hidden p-12 lg:p-24 text-center">
            <div className="absolute inset-0 bg-dark-900 dark:bg-dark-950 -z-10" />
            <div className="absolute inset-0 bg-gradient-to-br from-saffron-500/[0.15] to-blue-500/[0.08] -z-10 animate-pulse" />

            <h2 className="text-4xl lg:text-6xl font-bold mb-8 text-white tracking-tight">{t('landing.cta_title', 'Dominance is a Data Game.')}</h2>
            <p className="text-dark-300 dark:text-dark-400 max-w-2xl mx-auto mb-14 text-lg lg:text-xl font-medium leading-relaxed">
              {t('landing.cta_sub', "Don't leave your election to chance. Equip your campaign with enterprise-grade intelligence and tactical digital superiority today.")}
            </p>

            <button
              onClick={() => setIsLoginOpen(true)}
              className="btn-primary px-16 h-16 text-lg uppercase tracking-[3px] group rounded-2xl flex items-center justify-center gap-2 mx-auto"
            >
              <span>{t('landing.get_started', 'Get Started')}</span>
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </section>
      </main>

      {/* Footer Redesign - More structured and premium */}
      <footer className="border-t border-dark-100 dark:border-white/[0.05] bg-white dark:bg-dark-950 transition-colors">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8 mb-20">
            {/* Brand Column */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-saffron-500 to-saffron-700 rounded-xl flex items-center justify-center glow-saffron shadow-lg shadow-saffron-500/20">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <span className="font-extrabold text-2xl tracking-tighter text-dark-900 dark:text-white">MLA<span className="text-saffron-500">.</span>EMS</span>
              </div>
              <p className="text-dark-500 dark:text-dark-400 text-sm leading-relaxed max-w-xs mb-8">
                {t('landing.footer_brand', 'The most advanced digital platform for MLA candidates to manage high-stakes campaigns with data-driven tactical superiority.')}
              </p>
              <div className="flex gap-4">
                {[MessageSquare, Globe, Database, Shield].map((Icon, i) => (
                  <a key={i} href="#" className="w-10 h-10 rounded-full border border-dark-100 dark:border-white/5 flex items-center justify-center text-dark-400 hover:text-saffron-500 hover:border-saffron-500/50 transition-all">
                    <Icon className="w-5 h-5" />
                  </a>
                ))}
              </div>
            </div>

            {/* Links Columns */}
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-[3px] text-dark-900 dark:text-white mb-6">{t('landing.platform', 'Platform')}</h4>
              <ul className="space-y-4">
                {[
                  { key: 'footer.link.camp_intel', def: 'Campaign Intelligence' },
                  { key: 'footer.link.voter_anal', def: 'Voter Analytics' },
                  { key: 'footer.link.vol_mgr', def: 'Volunteer Management' },
                  { key: 'footer.link.booth_sys', def: 'Booth Systems' }
                ].map((item) => (
                  <li key={item.key}><a href="#" className="text-sm text-dark-500 dark:text-dark-400 hover:text-saffron-500 transition-colors">{t(item.key, item.def)}</a></li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-[10px] font-black uppercase tracking-[3px] text-dark-900 dark:text-white mb-6">{t('landing.resources', 'Resources')}</h4>
              <ul className="space-y-4">
                {[
                  { key: 'footer.link.doc', def: 'Documentation' },
                  { key: 'footer.link.sec_wp', def: 'Security Whitepaper' },
                  { key: 'footer.link.case_studies', def: 'Case Studies' },
                  { key: 'footer.link.api_access', def: 'API Access' }
                ].map((item) => (
                  <li key={item.key}><a href="#" className="text-sm text-dark-500 dark:text-dark-400 hover:text-saffron-500 transition-colors">{t(item.key, item.def)}</a></li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-[10px] font-black uppercase tracking-[3px] text-dark-900 dark:text-white mb-6">{t('landing.company', 'Company')}</h4>
              <ul className="space-y-4">
                {[
                  { key: 'footer.link.about', def: 'About Us' },
                  { key: 'footer.link.contact', def: 'Contact Sales' },
                  { key: 'footer.link.terms', def: 'Terms of Service' },
                  { key: 'footer.link.privacy', def: 'Privacy Policy' }
                ].map((item) => (
                  <li key={item.key}><a href="#" className="text-sm text-dark-500 dark:text-dark-400 hover:text-saffron-500 transition-colors">{t(item.key, item.def)}</a></li>
                ))}
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-dark-100 dark:border-white/[0.05] flex flex-col md:flex-row items-center justify-between gap-6">
            <p className="text-dark-400 dark:text-dark-500 text-[11px] font-medium tracking-wide uppercase">
              © 2026 XPanda Solutions.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
