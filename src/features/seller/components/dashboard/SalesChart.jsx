import React, { useState, useMemo, useRef } from "react";

const CHART_WIDTH = 320;
const CHART_HEIGHT = 100;
const PADDING = 10;

/**
 * Buyurtmalarni tanlangan davrga mos "quti"larga (bucket) bo'lib,
 * har bir quti uchun savdo yig'indisini hisoblaydi.
 */
const bucketOrders = (orders, timeframe) => {
  const now = Date.now();
  let bucketCount, bucketMs, labelFormat;

  if (timeframe === "Bugun") {
    bucketCount = 6;
    bucketMs = (4 * 60 * 60 * 1000); // 4 soatlik qutilar
    labelFormat = (d) => d.toLocaleTimeString("uz-UZ", { hour: "2-digit" });
  } else if (timeframe === "Hafta") {
    bucketCount = 7;
    bucketMs = 24 * 60 * 60 * 1000;
    labelFormat = (d) => d.toLocaleDateString("uz-UZ", { weekday: "short" });
  } else {
    bucketCount = 6;
    bucketMs = 5 * 24 * 60 * 60 * 1000; // 5 kunlik qutilar (~1 oy)
    labelFormat = (d) => d.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit" });
  }

  const rangeStart = now - bucketCount * bucketMs;

  const buckets = Array.from({ length: bucketCount }, (_, i) => ({
    start: rangeStart + i * bucketMs,
    end: rangeStart + (i + 1) * bucketMs,
    total: 0,
  }));

  orders.forEach((order) => {
    const t = Number(order.createdAt) || 0;
    const bucket = buckets.find((b) => t >= b.start && t < b.end);
    if (bucket) bucket.total += Number(order.totalAmount) || 0;
  });

  return buckets.map((b) => ({
    label: labelFormat(new Date(b.start)),
    total: b.total,
  }));
};

const SalesChart = ({ orders, timeframe, isPrivate }) => {
  const [activeIndex, setActiveIndex] = useState(null);
  const svgRef = useRef(null);

  const points = useMemo(() => bucketOrders(orders, timeframe), [orders, timeframe]);

  const maxValue = Math.max(...points.map((p) => p.total), 1);

  const coords = points.map((p, i) => {
    const x = PADDING + (i / (points.length - 1)) * (CHART_WIDTH - PADDING * 2);
    const y = CHART_HEIGHT - PADDING - (p.total / maxValue) * (CHART_HEIGHT - PADDING * 2);
    return { x, y, ...p };
  });

  const pathD = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
  const areaD = `${pathD} L${coords[coords.length - 1].x},${CHART_HEIGHT} L${coords[0].x},${CHART_HEIGHT} Z`;

  const handlePointerMove = (e) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const relativeX = ((clientX - rect.left) / rect.width) * CHART_WIDTH;
    let closest = 0;
    let minDist = Infinity;
    coords.forEach((c, i) => {
      const dist = Math.abs(c.x - relativeX);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    });
    setActiveIndex(closest);
  };

  const active = activeIndex !== null ? coords[activeIndex] : null;

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="w-full h-24 touch-none"
        onMouseMove={handlePointerMove}
        onMouseLeave={() => setActiveIndex(null)}
        onTouchMove={handlePointerMove}
        onTouchEnd={() => setActiveIndex(null)}
      >
        <defs>
          <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="0.35" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path d={areaD} fill="url(#salesGradient)" />
        <path d={pathD} fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {active && (
          <>
            <line x1={active.x} y1="0" x2={active.x} y2={CHART_HEIGHT} stroke="white" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="3,3" />
            <circle cx={active.x} cy={active.y} r="4" fill="white" />
          </>
        )}
      </svg>

      {active && (
        <div
          className="absolute -top-2 bg-slate-900 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg shadow-lg pointer-events-none whitespace-nowrap"
          style={{ left: `${(active.x / CHART_WIDTH) * 100}%`, transform: "translate(-50%, -100%)" }}
        >
          <div className="text-slate-300">{active.label}</div>
          <div>{isPrivate ? "•••• so'm" : `${active.total.toLocaleString()} so'm`}</div>
        </div>
      )}
    </div>
  );
};

export default SalesChart;
