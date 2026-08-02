import React from "react";

const Block = ({ className }) => (
  <div className={`bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse ${className}`} />
);

const ProductsSkeleton = () => (
  <div className="p-4 space-y-2.5">
    <Block className="h-24 w-full" />
    <Block className="h-24 w-full" />
    <Block className="h-24 w-full" />
    <Block className="h-24 w-full" />
  </div>
);

export default ProductsSkeleton;
