import React from "react";

const Block = ({ className }) => (
  <div className={`bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse ${className}`} />
);

const OrdersSkeleton = () => (
  <div className="space-y-2.5 py-1">
    <Block className="h-28 w-full" />
    <Block className="h-28 w-full" />
    <Block className="h-28 w-full" />
  </div>
);

export default OrdersSkeleton;
