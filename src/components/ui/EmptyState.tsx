import React from 'react';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';

const EmptyState: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-24 text-center max-w-md mx-auto">
    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-100 to-brand-300 flex items-center justify-center shadow-inner mb-6">
      <SparklesIcon className="w-8 h-8 text-brand-700" />
    </div>
    <h2 className="text-xl font-bold text-slate-800 tracking-tight mb-3">Create your first presentation</h2>
    <p className="text-slate-600 text-sm leading-relaxed mb-6">Design stunning slides collaboratively. Organize ideas quickly with drag & drop and rich text editing.</p>
    <Link to="/create" className="px-5 py-2.5 rounded-lg bg-brand-600 text-white font-semibold shadow hover:bg-brand-500 focus:ring-2 focus:ring-brand-400">New Presentation</Link>
  </div>
);

export default EmptyState;
