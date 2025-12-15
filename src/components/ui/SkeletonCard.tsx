import React from 'react';

const SkeletonCard: React.FC = () => (
  <div className="animate-pulse rounded-xl bg-white/60 backdrop-blur-xs border border-white/40 shadow-soft overflow-hidden">
    <div className="aspect-[4/3] bg-slate-200/60" />
    <div className="p-3 space-y-3">
      <div className="h-3 w-3/4 bg-slate-200 rounded" />
      <div className="h-3 w-1/2 bg-slate-200 rounded" />
      <div className="flex gap-2">
        <div className="h-4 w-8 bg-slate-200 rounded-full" />
        <div className="h-4 w-8 bg-slate-200 rounded-full" />
      </div>
      <div className="h-6 w-full bg-slate-200 rounded" />
    </div>
  </div>
);

export default SkeletonCard;
