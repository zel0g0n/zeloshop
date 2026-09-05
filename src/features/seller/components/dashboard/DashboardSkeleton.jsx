
const Block = ({ className }) => (
  <div className={`bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse ${className}`} />
);

// Yangi, ixcham Dashboard tuzilishiga moslashtirilgan skeleton —
// loyihaning umumiy theme-aware (och/to'q rejimga moslashuvchan)
// rang palitrasi bilan.
const DashboardSkeleton = () => (
  <div className="p-4 space-y-4">
    <div className="grid grid-cols-2 gap-2.5">
      <Block className="h-[74px]" />
      <Block className="h-[74px]" />
      <Block className="h-[74px]" />
      <Block className="h-[74px]" />
    </div>
    <div className="flex gap-2">
      <Block className="h-9 w-28" />
      <Block className="h-9 w-32" />
      <Block className="h-9 w-36" />
    </div>
    <Block className="h-16 w-full" />
    <Block className="h-16 w-full" />
    <Block className="h-16 w-full" />
  </div>
);

export default DashboardSkeleton;
