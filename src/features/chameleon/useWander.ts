import { useEffect, useRef } from "react";
import { useChameleonStore } from "../../store/useChameleonStore";

const prefersReduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * §6 徘徊: 数秒ごとにランダムな目標点へ、0.6〜1.2px/frame でのんびり移動。
 * 到着で停止＋小休止。phase が idle のときだけ動く。rAFは1本。
 */
export function useWander(getBounds: () => { w: number; h: number } | null) {
  const targetRef = useRef<{ x: number; y: number } | null>(null);
  const pauseUntilRef = useRef(0);

  useEffect(() => {
    if (prefersReduced()) return; // reduce時は徘徊しない
    let raf = 0;
    const margin = 70;

    const pickTarget = (b: { w: number; h: number }, from: { x: number; y: number }) => {
      // 近すぎない新目標を選ぶ
      for (let i = 0; i < 6; i++) {
        const t = {
          x: margin + Math.random() * Math.max(1, b.w - margin * 2),
          y: margin + Math.random() * Math.max(1, b.h - margin * 2),
        };
        if (Math.hypot(t.x - from.x, t.y - from.y) > 90) return t;
      }
      return { x: b.w / 2, y: b.h / 2 };
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const b = getBounds();
      if (!b) return;
      const { pos, phase, setPos, setFacing } = useChameleonStore.getState();
      if (phase !== "idle") {
        targetRef.current = null;
        return;
      }
      if (now < pauseUntilRef.current) return;

      if (!targetRef.current) targetRef.current = pickTarget(b, pos);
      const t = targetRef.current;
      const dx = t.x - pos.x;
      const dy = t.y - pos.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 2) {
        // 到着 → 小休止してから次の目標
        targetRef.current = null;
        pauseUntilRef.current = now + 900 + Math.random() * 2200;
        return;
      }
      const speed = 0.6 + Math.random() * 0.6; // 0.6〜1.2px/frame
      const step = Math.min(dist, speed);
      const nx = pos.x + (dx / dist) * step;
      const ny = pos.y + (dy / dist) * step;
      setPos({ x: nx, y: ny });
      if (Math.abs(dx) > 1) setFacing(dx >= 0 ? 1 : -1);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [getBounds]);
}
