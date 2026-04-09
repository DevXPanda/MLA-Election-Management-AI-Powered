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
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
        titleColor: theme === 'dark' ? '#f1f5f9' : '#1e293b',
        bodyColor: theme === 'dark' ? '#94a3b8' : '#475569',
        borderColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 12,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { 
          color: theme === 'dark' ? '#64748b' : '#334155', 
          font: { size: 10, weight: '500' } 
        },
      },
      y: {
        grid: { 
          color: theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)' 
        },
        ticks: { 
          color: theme === 'dark' ? '#64748b' : '#334155', 
          font: { size: 10, weight: '500' } 
        },
        border: { display: false },
      },
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
        <Header title="War Room Dashboard" subtitle="Loading secure mission data..." />
        <div className="dashboard-container space-y-8 animate-pulse text-dark-400">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
        title={user?.role_name === 'booth_worker' ? 'Tactical Ops: Ground Zero' : 'Strategic Command Center'} 
        subtitle={user?.role_name === 'booth_worker' ? 'Logged in as Field Operative' : `Logged in as ${user?.role_name?.replace(/_/g, ' ').toUpperCase()}`} 
      />
      {renderRoleDashboard()}
    </main>
  );
}
