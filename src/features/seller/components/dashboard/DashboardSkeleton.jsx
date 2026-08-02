import React from "react";

const Block = ({ className }) => (
  <div className={`bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse ${className}`} />
);

const DashboardSkeleton = () => (
  <div className="p-4 space-y-4">
    <Block className="h-9 w-full" />
    <Block className="h-40 w-full" />
    <Block className="h-11 w-full" />
    <div className="grid grid-cols-2 gap-3">
      <Block className="h-24" />
      <Block className="h-24" />
      <Block className="h-24" />
      <Block className="h-24" />
    </div>
    <div className="grid grid-cols-3 gap-2">
      <Block className="h-16" />
      <Block className="h-16" />
      <Block className="h-16" />
    </div>
    <Block className="h-40 w-full" />
  </div>
);

export default DashboardSkeleton;
