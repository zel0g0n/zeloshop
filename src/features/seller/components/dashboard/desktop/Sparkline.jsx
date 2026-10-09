import { memo, useId } from "react";

/**
 * Kichik trend chizig'i (KPI kartochka ostida). viewBox + `preserveAspectRatio="none"`
 * — o'lcham o'lchash shart emas, kenglikka o'zi cho'ziladi; chiziq qalinligi
 * `non-scaling-stroke` bilan o'zgarmaydi.
 */
const W = 100;
const H = 32;

const Sparkline = ({ values, color, label }) => {
  const gid = useId().replace(/:/g, "");
  const data = values && values.length > 1 ? values : [0, 0];
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => [(i / (data.length - 1)) * W, H - 3 - (v / max) * (H - 8)]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" ");
  const area = `${line} L${W} ${H} L0 ${H} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-9 overflow-visible" role="img" aria-label={label}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r="2" fill={color} vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

export default memo(Sparkline);
