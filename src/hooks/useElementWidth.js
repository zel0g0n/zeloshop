import { useEffect, useRef, useState } from "react";

/** Elementning haqiqiy o'lchamini (ResizeObserver) kuzatadi — SVG grafiklar uchun. */
export function useElementSize() {
  const ref = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => setSize({ width: Math.round(el.clientWidth), height: Math.round(el.clientHeight) });
    update();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}
