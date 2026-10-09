import { memo } from "react";

const R = 52;
const C = 2 * Math.PI * R;

/** Buyurtmalar holati donut'i. `segments`: [{key,count,color}], markazda jami son. */
const StatusDonut = ({ segments, total, centerLabel }) => {
  let offset = 0;
  return (
    <svg viewBox="0 0 140 140" className="w-44 h-44 shrink-0" role="img" aria-label={centerLabel}>
      <circle cx="70" cy="70" r={R} fill="none" strokeWidth="16" className="stroke-slate-100 dark:stroke-slate-800" />
      {total > 0 &&
        segments
          .filter((s) => s.count > 0)
          .map((s) => {
            const len = (s.count / total) * C;
            const gap = segments.filter((x) => x.count > 0).length > 1 ? 2 : 0;
            const el = (
              <circle
                key={s.key}
                cx="70"
                cy="70"
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth="16"
                strokeDasharray={`${Math.max(len - gap, 0.5)} ${C - Math.max(len - gap, 0.5)}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 70 70)"
              />
            );
            offset += len;
            return el;
          })}
      <text x="70" y="68" textAnchor="middle" className="fill-slate-800 dark:fill-white" style={{ fontSize: 26, fontWeight: 900 }}>{total}</text>
      <text x="70" y="86" textAnchor="middle" className="fill-slate-400 dark:fill-slate-500" style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>{centerLabel}</text>
    </svg>
  );
};

export default memo(StatusDonut);
