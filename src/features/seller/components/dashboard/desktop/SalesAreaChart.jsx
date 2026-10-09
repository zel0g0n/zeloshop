import { memo, useMemo, useState } from "react";
import { useElementSize } from "@/hooks/useElementWidth";
import { niceScale, formatCompact, formatMoney } from "@/utils/dashboardCharts";

const REVENUE = "#5346E0";
const PROFIT = "#10b981";
const PAD = { top: 12, right: 12, bottom: 28, left: 52 };

const fmtDay = (ms) =>
  new Date(ms).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", timeZone: "Asia/Tashkent" }).replace("/", ".");

/** Savdo va foyda — ikki qatlamli maydon grafigi (qo'lda chizilgan SVG, kutubxonasiz). */
const SalesAreaChart = ({ series, hidden, labels }) => {
  const [boxRef, { width, height }] = useElementSize();
  const [hover, setHover] = useState(null);

  const geo = useMemo(() => {
    const maxV = Math.max(...series.map((d) => Math.max(d.revenue, d.profit)), 0);
    const scale = niceScale(maxV, 4);
    const w = Math.max(width - PAD.left - PAD.right, 10);
    const h = Math.max(height - PAD.top - PAD.bottom, 10);
    const x = (i) => PAD.left + (series.length > 1 ? (i / (series.length - 1)) * w : w / 2);
    const y = (v) => PAD.top + h - (v / scale.max) * h;
    const path = (key) => series.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(d[key]).toFixed(1)}`).join(" ");
    const area = (key) => `${path(key)} L${x(series.length - 1).toFixed(1)} ${PAD.top + h} L${x(0).toFixed(1)} ${PAD.top + h} Z`;
    return { scale, w, h, x, y, revLine: path("revenue"), profLine: path("profit"), revArea: area("revenue"), profArea: area("profit") };
  }, [series, width, height]);

  const every = Math.max(1, Math.ceil(series.length / Math.max(Math.floor(geo.w / 64), 1)));
  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const ratio = (px - PAD.left) / geo.w;
    const idx = Math.round(ratio * (series.length - 1));
    setHover(Math.min(Math.max(idx, 0), series.length - 1));
  };
  const hv = hover != null ? series[hover] : null;
  const mask = (v) => (hidden ? "•••" : `${formatMoney(v)} so'm`);

  return (
    <div ref={boxRef} className="relative w-full h-full min-h-[260px]">
      {width > 0 && (
        <svg width={width} height={height} className="block" onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label={labels.revenue}>
          <defs>
            <linearGradient id="dash-rev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={REVENUE} stopOpacity="0.28" />
              <stop offset="100%" stopColor={REVENUE} stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="dash-prof" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={PROFIT} stopOpacity="0.25" />
              <stop offset="100%" stopColor={PROFIT} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {geo.scale.ticks.map((tv) => (
            <g key={tv}>
              <line x1={PAD.left} x2={PAD.left + geo.w} y1={geo.y(tv)} y2={geo.y(tv)} className="stroke-slate-100 dark:stroke-slate-800" strokeDasharray={tv === 0 ? "0" : "3 4"} />
              <text x={PAD.left - 10} y={geo.y(tv) + 3.5} textAnchor="end" className="fill-slate-400 dark:fill-slate-500" style={{ fontSize: 10, fontWeight: 600 }}>
                {hidden && tv > 0 ? "•••" : formatCompact(tv)}
              </text>
            </g>
          ))}

          {series.map((d, i) =>
            i % every === 0 || i === series.length - 1 ? (
              <text key={d.dateMs} x={geo.x(i)} y={PAD.top + geo.h + 18} textAnchor={i === 0 ? "start" : i === series.length - 1 ? "end" : "middle"} className="fill-slate-400 dark:fill-slate-500" style={{ fontSize: 10, fontWeight: 600 }}>
                {fmtDay(d.dateMs)}
              </text>
            ) : null
          )}

          <path d={geo.revArea} fill="url(#dash-rev)" />
          <path d={geo.profArea} fill="url(#dash-prof)" />
          <path d={geo.revLine} fill="none" stroke={REVENUE} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
          <path d={geo.profLine} fill="none" stroke={PROFIT} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

          {hv && (
            <g pointerEvents="none">
              <line x1={geo.x(hover)} x2={geo.x(hover)} y1={PAD.top} y2={PAD.top + geo.h} className="stroke-slate-300 dark:stroke-slate-600" strokeDasharray="3 3" />
              <circle cx={geo.x(hover)} cy={geo.y(hv.revenue)} r="4.5" fill={REVENUE} className="stroke-white dark:stroke-slate-900" strokeWidth="2" />
              <circle cx={geo.x(hover)} cy={geo.y(hv.profit)} r="4" fill={PROFIT} className="stroke-white dark:stroke-slate-900" strokeWidth="2" />
            </g>
          )}
          {!hv && series.length > 0 && (
            <circle cx={geo.x(series.length - 1)} cy={geo.y(series[series.length - 1].revenue)} r="4" fill={REVENUE} className="stroke-white dark:stroke-slate-900" strokeWidth="2" />
          )}
        </svg>
      )}

      {hv && (
        <div
          className="absolute z-10 pointer-events-none rounded-xl bg-slate-900 dark:bg-slate-700 text-white px-3 py-2.5 shadow-xl text-xs min-w-[160px]"
          style={{ left: Math.min(Math.max(geo.x(hover) - 80, 4), Math.max(width - 168, 4)), top: 4 }}
        >
          <p className="font-black text-[11px] text-slate-300 mb-1.5">{fmtDay(hv.dateMs)}</p>
          <p className="flex items-center justify-between gap-4"><span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full" style={{ background: REVENUE }} />{labels.revenue}</span><b>{mask(hv.revenue)}</b></p>
          <p className="flex items-center justify-between gap-4 mt-1"><span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full" style={{ background: PROFIT }} />{labels.profit}</span><b>{mask(hv.profit)}</b></p>
          <p className="flex items-center justify-between gap-4 mt-1 text-slate-300"><span>{labels.orders}</span><b>{hv.orders}</b></p>
        </div>
      )}
    </div>
  );
};

export default memo(SalesAreaChart);
