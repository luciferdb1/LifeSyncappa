import { Shield, Crown, Briefcase, Camera, Heart, User, LucideIcon } from 'lucide-react';

export const getRoleBadgeDefinition = (role: string): { icon: LucideIcon, label: string, color: string } => {
  switch (role) {
    case 'admin': 
      return { icon: Shield, label: 'Admin', color: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800' };
    case 'president': 
      return { icon: Crown, label: 'President', color: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-500 border-amber-200 dark:border-amber-800' };
    case 'secretary': 
      return { icon: Briefcase, label: 'Secretary Team', color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800' };
    case 'media': 
      return { icon: Camera, label: 'Media Team', color: 'bg-fuchsia-100 dark:bg-fuchsia-900/40 text-fuchsia-700 dark:text-fuchsia-400 border-fuchsia-200 dark:border-fuchsia-800' };
    case 'volunteer':
    case 'editor': // Legacy support
      return { icon: Heart, label: 'Volunteer', color: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' };
    default: 
      return { icon: User, label: 'User', color: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-700' };
  }
};
