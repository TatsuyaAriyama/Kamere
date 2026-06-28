import { useEffect, useRef } from "react";

export type GrabRequest = {
  id: number;
  from: { x: number; y: number }; // 口元 (stage-local)
  to: { x: number; y: number }; // 標的 (stage-local)
  color: string; // 採色した色（パッドが持ち帰る）
};

const TONGUE = "#E2674C";
const TONGUE_DEEP = "#C24E36";
const PAD = "#F4A98F";

// フェーズ時間(ms): 照準 → 射出 → 吸着 → 引き戻し
const T_AIM = 150;
const T_EXTEND = 95;
const T_STICK = 95;
const T_RETRACT = 250;

const prefersReduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const easeOutBack = (t: number) => {
  const c = 1.7;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};
const easeInCubic = (t: number) => t * t * t;

type Props = {
  grab: GrabRequest | null;
  width: number;
  height: number;
  onStart: () => void;
  onCommit: (id: number) => void;
};

export default function Tongue({ grab, width, height, onStart, onCommit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    c.width = Math.round(width * dpr);
    c.height = Math.round(height * dpr);
    const ctx = c.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, [width, height]);

  useEffect(() => {
    if (!grab) return;
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;

    onStart();
    const reduced = prefersReduced();
    const aimT = reduced ? 30 : T_AIM;
    const extend = reduced ? 40 : T_EXTEND;
    const stick = reduced ? 30 : T_STICK;
    const retract = reduced ? 60 : T_RETRACT;
    const total = aimT + extend + stick + retract;

    const { from, to, color } = grab;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    // 舌が垂れる方向（進行方向に対し垂直、やや下向き）
    const nx = -dy / len;
    const ny = dx / len;
    const sagDir = ny >= 0 ? 1 : -1;
    const sag = Math.min(26, len * 0.16) * sagDir;

    let raf = 0;
    const start = performance.now();

    // 太さ: 根元 hwBase → 先端 hwTip
    const hwBase = 5.2;
    const hwTip = 2.4;

    const drawRibbon = (reach: number, carry: string | null, padScale: number) => {
      // 二次ベジェ（口元→標的）に沿った帯。reach で先端位置を制御。
      const cx = from.x + dx * 0.5 + nx * sag;
      const cy = from.y + dy * 0.5 + ny * sag;
      const N = 18;
      const left: [number, number][] = [];
      const right: [number, number][] = [];
      let tipX = from.x;
      let tipY = from.y;
      for (let i = 0; i <= N; i++) {
        const t = (i / N) * reach;
        const mt = 1 - t;
        const px = mt * mt * from.x + 2 * mt * t * cx + t * t * to.x;
        const py = mt * mt * from.y + 2 * mt * t * cy + t * t * to.y;
        // 接線→法線
        const tgx = 2 * mt * (cx - from.x) + 2 * t * (to.x - cx);
        const tgy = 2 * mt * (cy - from.y) + 2 * t * (to.y - cy);
        const tl = Math.hypot(tgx, tgy) || 1;
        const lnx = -tgy / tl;
        const lny = tgx / tl;
        const hw = hwBase + (hwTip - hwBase) * (i / N);
        left.push([px + lnx * hw, py + lny * hw]);
        right.push([px - lnx * hw, py - lny * hw]);
        tipX = px;
        tipY = py;
      }
      // 帯本体
      ctx.beginPath();
      ctx.moveTo(left[0][0], left[0][1]);
      for (const [x, y] of left) ctx.lineTo(x, y);
      for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
      ctx.closePath();
      const grad = ctx.createLinearGradient(from.x, from.y, tipX, tipY);
      grad.addColorStop(0, TONGUE_DEEP);
      grad.addColorStop(1, TONGUE);
      ctx.fillStyle = grad;
      ctx.fill();

      // 粘着パッド（吸着後は採色した色を持ち帰る）
      const padR = (6.4 + (padScale - 1) * 4) ;
      ctx.beginPath();
      ctx.ellipse(tipX, tipY, padR * (carry ? 1.05 : 1), padR * (carry ? 0.9 : 1), 0, 0, Math.PI * 2);
      ctx.fillStyle = carry ?? PAD;
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = "rgba(0,0,0,0.12)";
      ctx.stroke();
    };

    const draw = (now: number) => {
      const t = now - start;
      ctx.clearRect(0, 0, width, height);

      if (t < aimT) {
        // 照準: まだ舌は出さない（カメレオンがしゃがんで溜める）
      } else if (t < aimT + extend) {
        const e = (t - aimT) / extend;
        drawRibbon(Math.min(1, easeOutBack(e)), null, 1);
      } else if (t < aimT + extend + stick) {
        const g = (t - aimT - extend) / stick;
        const pulse = 1 + Math.sin(g * Math.PI) * 0.5;
        // 吸着の瞬間に色を拾う（半分以降は色を持つ）
        drawRibbon(1, g > 0.4 ? color : null, pulse);
      } else {
        const r = (t - aimT - extend - stick) / retract;
        drawRibbon(1 - easeInCubic(Math.min(1, r)), color, 1);
      }

      if (t >= total) {
        ctx.clearRect(0, 0, width, height);
        onCommit(grab.id);
        return;
      }
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, width, height);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grab?.id]);

  return <canvas ref={canvasRef} className="tongue-canvas" style={{ width, height }} aria-hidden />;
}
