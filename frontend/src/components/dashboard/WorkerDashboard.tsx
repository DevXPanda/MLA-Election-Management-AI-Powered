'use client';

import { ListTodo, CheckCircle2, ClipboardPlus, Zap, ArrowRight, Activity, Calendar, UserCheck } from 'lucide-react';
import { format } from 'date-fns';
import { DashboardStats } from '@/types';
import Link from 'next/link';

interface DashboardProps {
   stats: DashboardStats;
   chartDefaults: any;
}

export default function WorkerDashboard({ stats }: DashboardProps) {
   const { my_completed_tasks, my_pending_tasks, total_surveys_submitted, surveys_today } = stats.stats;

   const statCards = [
      { label: 'Active Tasks', value: my_pending_tasks || 0, icon: ListTodo, color: 'text-amber-400', bgIcon: 'bg-amber-500/12' },
      { label: 'Tasks Done', value: my_completed_tasks || 0, icon: CheckCircle2, color: 'text-emerald-400', bgIcon: 'bg-emerald-500/12' },
      { label: 'Total Surveys', value: total_surveys_submitted || 0, icon: ClipboardPlus, color: 'text-blue-400', bgIcon: 'bg-blue-500/12' },
      { label: 'Today', value: surveys_today || 0, icon: Zap, color: 'text-purple-400', bgIcon: 'bg-purple-500/12' },
   ];

   return (
      <div className="p-8 pb-12">
         {/* Primary Field Action */}
         <div className="gradient-card p-7 mb-8 relative group overflow-hidden border border-saffron-500/20 rounded-lg shadow-2xl shadow-saffron-500/10 hover:shadow-saffron-500/20 transition-all">
            <div className="relative z-10">
               <h2 className="text-2xl font-black text-dark-900 dark:text-white flex items-center gap-4 mb-0">
                  <Zap className="w-7 h-7 text-saffron-500 animate-pulse" /> My Field Operations
               </h2>
               <p className="text-sm text-dark-600 dark:text-dark-400 max-w-sm mt-2 font-medium leading-relaxed">
                  Help your booth reach 100% coverage by performing regular surveys and tasks.
               </p>
               <div className="flex flex-wrap gap-4 mt-8">
                  <Link href="/dashboard/surveys" className="inline-flex items-center gap-3 px-8 py-4 bg-saffron-400 text-dark-900 font-black text-xs uppercase tracking-[2px] rounded-lg shadow-xl shadow-saffron-500/30 hover:scale-[1.05] hover:shadow-saffron-500/50 transition-all transform active:scale-95 group/btn">
                     Submit Survey <ClipboardPlus className="w-5 h-5 group-hover/btn:rotate-12 transition-transform" />
                  </Link>
                  <Link href="/dashboard/voters" className="inline-flex items-center gap-3 px-8 py-4 bg-white/5 text-dark-100 font-black text-xs uppercase tracking-[2px] rounded-lg border border-white/5 hover:bg-white/10 transition-all active:scale-95">
                     Search Voters <ArrowRight className="w-4 h-4" />
                  </Link>
               </div>
            </div>
            <div className="absolute -top-20 -right-20 h-[400px] w-[400px] bg-saffron-500/10 blur-[120px] rounded-full group-hover:bg-saffron-500/20 transition-all duration-700" />
         </div>

         <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {statCards.map((card) => (
               <div key={card.label} className="glass-card-hover p-6 relative overflow-hidden group border border-white/[0.03]">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${card.bgIcon} mb-5 group-hover:scale-110 transition-transform`}>
                     <card.icon className={`w-6 h-6 ${card.color}`} />
                  </div>
                  <div className="text-3xl font-black text-dark-900 dark:text-white tracking-tight">{card.value}</div>
                  <div className="text-[11px] text-dark-600 dark:text-dark-500 font-black uppercase tracking-[2px] mt-2 leading-none">{card.label}</div>
               </div>
            ))}
         </div>

         {/* Task List Section - Strictly Tactical */}
         <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
            <div className="glass-card overflow-hidden flex flex-col">
               <div className="p-6 border-b border-white/5 flex items-center justify-between">
                  <h3 className="text-base font-black text-dark-900 dark:text-white flex items-center gap-3">
                     <ListTodo className="w-5 h-5 text-amber-400" /> My Priority Assignment
                  </h3>
                  <Link href="/dashboard/tasks" className="text-[10px] font-black text-saffron-400 uppercase tracking-widest hover:text-saffron-300 transition-colors bg-saffron-400/5 px-3 py-1 rounded-full border border-saffron-500/10">Manage All</Link>
               </div>
               <div className="p-4 space-y-4">
                  {stats.lists.tasks?.slice(0, 5).map((task) => (
                     <div key={task.id} className="p-5 rounded-lg bg-dark-800/20 hover:bg-dark-800/40 transition-all border border-white/[0.03] group flex items-center justify-between">
                        <div className="min-w-0">
                           <div className="text-sm font-black text-dark-900 dark:text-white group-hover:text-saffron-500 transition-colors mb-1 truncate">{task.title}</div>
                           <div className="text-[10px] text-dark-600 dark:text-dark-500 font-bold uppercase flex items-center gap-3 tracking-widest">
                              <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-dark-700 dark:text-dark-600" /> {format(new Date(task.due_date), 'dd MMM')}</span>
                              <span className={`w-2 h-2 rounded-full ${task.priority === 'high' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-amber-500'}`} />
                              <span className="opacity-60">{task.priority}</span>
                           </div>
                        </div>
                        <Link href={`/dashboard/tasks/${task.id}`} className="text-[10px] font-black text-dark-100 uppercase tracking-wider bg-white/5 px-4 py-2 rounded-lg border border-white/5 hover:bg-saffron-500 hover:text-dark-900 transition-all">
                           Open
                        </Link>
                     </div>
                  ))}
                  {(!stats.lists.tasks || stats.lists.tasks.length === 0) && (
                     <div className="py-16 flex flex-col items-center justify-center opacity-40">
                        <CheckCircle2 size={48} className="text-emerald-500 mb-4" />
                        <p className="text-sm font-black uppercase tracking-widest">Targets Cleared</p>
                     </div>
                  )}
               </div>
            </div>
         </div>
      </div>
   );
}
