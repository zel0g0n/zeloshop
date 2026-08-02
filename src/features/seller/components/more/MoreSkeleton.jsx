import React from "react";

const Block = ({ className }) => (
  <div className={`bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse ${className}`} />
);

const MoreSkeleton = () => (
  <div className="p-4 space-y-5">
    <Block className="h-20 w-full" />
    <div className="space-y-2">
      <Block className="h-3 w-24 rounded-full" />
      <Block className="h-40 w-full" />
    </div>
    <div className="space-y-2">
      <Block className="h-3 w-24 rounded-full" />
      <Block className="h-52 w-full" />
    </div>
    <div className="space-y-2">
      <Block className="h-3 w-24 rounded-full" />
      <Block className="h-32 w-full" />
    </div>
  </div>
);

export default MoreSkeleton;
