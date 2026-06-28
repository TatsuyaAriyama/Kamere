import { useEffect, useRef } from "react";
import type { ColorSourceHandle } from "./source";

const LENS = 120; // 直径(px)
const ZOOM = 8;
const OFFSET_Y = 92; // 指の上にずらす

type Props = {
  visible: boolean;
  localX: number;
  localY: number;
  clientX: number;
  clientY: number;
  hex: string | null;
  source: ColorSourceHandle | null;
};

export default function Loupe({ visible, localX, localY, clientX, clientY, hex, source }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!visible) return;
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx || !source) return;
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    if (c.width !== LENS * dpr) {
      c.width = LENS * dpr;
      c.height = LENS * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, LENS, LENS);
    source.drawLoupe(ctx, clientX, clientY, LENS, ZOOM);
    // 中央のピクセル枠（照準）
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1.5;
    const px = ZOOM; // 1ソースpxの表示サイズ ≒ ZOOM
    ctx.strokeRect(LENS / 2 - px / 2, LENS / 2 - px / 2, px, px);
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.strokeRect(LENS / 2 - px / 2 - 1, LENS / 2 - px / 2 - 1, px + 2, px + 2);
  }, [visible, clientX, clientY, source]);

  if (!visible) return null;

  const cx = localX;
  const cy = localY - OFFSET_Y;

  return (
    <div className="loupe" style={{ left: cx, top: cy }} aria-hidden>
      <div className="loupe-lens" style={{ width: LENS, height: LENS }}>
        <canvas ref={canvasRef} style={{ width: LENS, height: LENS }} />
      </div>
      <div className="loupe-hex" style={{ fontFamily: "var(--font-mono)" }}>
        {hex ?? "—"}
      </div>
    </div>
  );
}

export { LENS };
