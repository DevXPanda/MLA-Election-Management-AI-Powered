'use client';

import { useState, useEffect, useMemo } from 'react';
import Header from '@/components/Header';
import { dashboardAPI } from '@/lib/api';
import { DashboardStats } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  ArcElement, Title, Tooltip, Legend, Filler
} from 'chart.js';

import AdminDashboard from '@/components/dashboard/AdminDashboard';
import MlaDashboard from '@/components/dashboard/MlaDashboard';
import ManagerDashboard from '@/components/dashboard/ManagerDashboard';
import WardHeadDashboard from '@/components/dashboard/WardHeadDashboard';
import WorkerDashboard from '@/components/dashboard/WorkerDashboard';
import { MODULE_HEADER } from '@/lib/ui-labels';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  ArcElement, Title, Tooltip, Legend, Filler
);

export default function DashboardPage() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const chartDefaults = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: { top: 10, bottom: 0, left: 0, right: 10 }
    },
    plugins: {
      legend: { 
        display: false,
      },
      tooltip: {
        backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
        titleColor: theme === 'dark' ? '#f1f5f9' : '#1e293b',
        bodyColor: theme === 'dark' ? '#94a3b8' : '#475569',
        borderColor: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
        borderWidth: 1,
        padding: 14,
        cornerRadius: 16,
        usePointStyle: true,
        titleFont: { size: 13, weight: 700 },
        bodyFont: { size: 12 },
        boxPadding: 6,
        shadowBlur: 10,
        shadowColor: 'rgba(0,0,0,0.1)',
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { 
          color: theme === 'dark' ? '#64748b' : '#334155', 
          font: { size: 11, weight: 400, family: "'Inter', sans-serif" },
          padding: 10
        },
      },
      y: {
        beginAtZero: true,
        grid: { 
          color: theme === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.03)',
          drawTicks: false,
        },
        ticks: { 
          color: theme === 'dark' ? '#64748b' : '#334155', 
          font: { size: 11, weight: 400, family: "'Inter', sans-serif" },
          padding: 12,
          maxTicksLimit: 6
        },
        border: { display: false },
      },
    },
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
  }), [theme]);

  useEffect(() => {
    loadDashboard();
  }, [user]);

  const loadDashboard = async () => {
    try {
      const res = await dashboardAPI.getStats();
      setStats(res.data.data);
    } catch (err) {
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderRoleDashboard = () => {
    if (!stats || !user) return null;

    const role = user.role_name;

    switch (role) {
      case 'super_admin':
        return <AdminDashboard stats={stats} chartDefaults={chartDefaults} />;
      
      case 'mla':
        return <MlaDashboard stats={stats} chartDefaults={chartDefaults} />;
      
      case 'campaign_manager':
        return <ManagerDashboard stats={stats} chartDefaults={chartDefaults} />;
      
      case 'ward_head':
        return <WardHeadDashboard stats={stats} chartDefaults={chartDefaults} />;
      
      case 'booth_worker':
        return <WorkerDashboard stats={stats} chartDefaults={chartDefaults} />;
      
      default:
        return <AdminDashboard stats={stats} chartDefaults={chartDefaults} />;
    }
  };

  if (loading || !stats) {
    return (
      <div className="min-h-screen bg-white dark:bg-dark-950 flex flex-col transition-colors duration-300">
        <Header title={MODULE_HEADER.dashboardLoading.title} subtitle={MODULE_HEADER.dashboardLoading.subtitle} />
        <div className="dashboard-container space-y-8 animate-pulse text-dark-400">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="glass-card h-32" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="glass-card h-80" />
            <div className="glass-card lg:col-span-2 h-80" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-white dark:bg-dark-950 selection:bg-saffron-500/30 transition-colors duration-300">
      <Header 
        title={MODULE_HEADER.dashboard.title} 
        subtitle={user?.role_name === 'booth_worker' ? 'Field worker overview' : `Signed in as ${user?.role_name?.replace(/_/g, ' ')}`} 
      />
      {renderRoleDashboard()}
    </main>
  );
}
