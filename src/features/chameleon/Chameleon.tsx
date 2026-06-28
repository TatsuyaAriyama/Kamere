import { useEffect, useId, useRef, useState } from "react";
import { useChameleonStore } from "../../store/useChameleonStore";
import { hexToRgb } from "../../lib/color";
import { paletteFor } from "./marble";

// ── ジオメトリ ────────────────────────────────────────────
// viewBox 内、facing=右。口元(基準点)に store.pos を一致させる。
const VB_W = 240;
const VB_H = 180;
const MOUTH = { x: 229, y: 95 };
const PX_W = 150; // 表示幅(px)
const SCALE = PX_W / VB_W;
const PX_H = VB_H * SCALE;
const MOUTH_PX = { x: MOUTH.x * SCALE, y: MOUTH.y * SCALE };

const prefersReduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

type Props = {
  toLocal: (clientX: number, clientY: number) => { x: number; y: number };
  onPickRelease: (local: { x: number; y: number }) => void;
};

export default function Chameleon({ toLocal }: Props) {
  const pos = useChameleonStore((s) => s.pos);
  const facing = useChameleonStore((s) => s.facing);
  const phase = useChameleonStore((s) => s.phase);
  const bodyColor = useChameleonStore((s) => s.bodyColor);
  const aim = useChameleonStore((s) => s.aim);
  const setPos = useChameleonStore((s) => s.setPos);
  const setFacing = useChameleonStore((s) => s.setFacing);
  const setPhase = useChameleonStore((s) => s.setPhase);

  const id = useId().replace(/:/g, "");
  const dragOffset = useRef({ x: 0, y: 0 });
  const lastX = useRef(pos.x);
  const [pulse, setPulse] = useState(false);
  const [blink, setBlink] = useState(false);

  const pal = paletteFor(bodyColor, bodyColor ? hexToRgb(bodyColor) : null);
  const trans = prefersReduced() ? "none" : "fill .5s ease, stroke .5s ease";

  // 採色時の体色遷移に合わせた脈動
  useEffect(() => {
    if (!bodyColor || prefersReduced()) return;
    setPulse(true);
    const t = window.setTimeout(() => setPulse(false), 420);
    return () => window.clearTimeout(t);
  }, [bodyColor]);

  // 瞬き
  useEffect(() => {
    if (prefersReduced()) return;
    let to = 0;
    const iv = window.setInterval(() => {
      setBlink(true);
      to = window.setTimeout(() => setBlink(false), 130);
    }, 3600 + Math.random() * 1800);
    return () => {
      window.clearInterval(iv);
      window.clearTimeout(to);
    };
  }, []);

  // 目線（照準方向へ瞳を寄せる）
  let lookX = 0;
  let lookY = 0;
  if (aim) {
    const dx = aim.x - pos.x;
    const dy = aim.y - pos.y;
    const d = Math.hypot(dx, dy) || 1;
    lookX = (dx / d) * 3.4 * facing;
    lookY = (dy / d) * 3.0;
  }

  // ── ドラッグで定位置を移動（採色はしない） ──
  const onPointerDown = (e: React.PointerEvent) => {
    if (phase === "grabbing") return;
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const local = toLocal(e.clientX, e.clientY);
    dragOffset.current = { x: local.x - pos.x, y: local.y - pos.y };
    lastX.current = pos.x;
    setPhase("dragging");
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (phase !== "dragging") return;
    const local = toLocal(e.clientX, e.clientY);
    const next = { x: local.x - dragOffset.current.x, y: local.y - dragOffset.current.y };
    const dx = next.x - lastX.current;
    if (Math.abs(dx) > 0.5) setFacing(dx >= 0 ? 1 : -1);
    lastX.current = next.x;
    setPos(next);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (phase !== "dragging") return;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    setPhase("idle");
  };

  const eyeCx = 196;
  const eyeCy = 82;

  return (
    <div
      className={`chameleon${phase === "dragging" ? " is-dragging" : ""}${
        phase === "grabbing" ? " is-grabbing" : ""
      }${pulse ? " pulse" : ""}`}
      style={{
        left: pos.x - MOUTH_PX.x,
        top: pos.y - MOUTH_PX.y,
        width: PX_W,
        height: PX_H,
        transform: facing === -1 ? "scaleX(-1)" : undefined,
        transformOrigin: `${MOUTH_PX.x}px ${MOUTH_PX.y}px`,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="img"
      aria-label="カメレオン"
    >
      <svg className="cham-svg" viewBox={`0 0 ${VB_W} ${VB_H}`}>
        <defs>
          <clipPath id={`body-${id}`}>
            <path d="M60,98 C64,60 92,46 120,46 C150,46 170,52 184,64 C198,76 214,86 229,94 C218,103 205,107 192,108 C165,113 142,116 124,122 C106,128 84,128 72,120 C62,114 56,108 60,98 Z" />
          </clipPath>
        </defs>

        {/* 止まり木（枝）— 定位置の足場 */}
        <g opacity="0.92">
          <path
            d="M14,156 Q78,150 150,156"
            fill="none"
            stroke="#5B4F40"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d="M16,154 Q78,148 148,154"
            fill="none"
            stroke="#6E6150"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.7"
          />
          <path d="M120,154 q14,2 22,-6" fill="none" stroke="#5B4F40" strokeWidth="5" strokeLinecap="round" />
        </g>

        {/* 巻いた把握尾 */}
        <path
          d="M64,108 C48,116 40,134 52,146 C66,158 88,150 86,132 C85,118 70,114 62,124 C56,131 62,140 70,138"
          fill="none"
          strokeLinecap="round"
          strokeWidth="11"
          style={{ stroke: pal.mid, transition: trans }}
        />
        <path
          d="M64,108 C48,116 40,134 52,146 C66,158 88,150 86,132 C85,118 70,114 62,124 C56,131 62,140 70,138"
          fill="none"
          strokeLinecap="round"
          strokeWidth="4"
          opacity="0.5"
          style={{ stroke: pal.deep, transition: trans }}
        />

        {/* 後肢（合趾足で枝を掴む） */}
        <g style={{ stroke: pal.deep, transition: trans }} strokeLinecap="round" fill="none">
          <path d="M98,114 C90,126 84,138 93,149" strokeWidth="13" />
          {/* 合趾のピンサー（2趾＋3趾で枝を挟む） */}
          <path d="M93,150 c-7,1 -11,3 -13,6" strokeWidth="6" />
          <path d="M93,150 c5,2 9,4 11,7" strokeWidth="6" />
        </g>
        {/* 前肢 */}
        <g style={{ stroke: pal.deep, transition: trans }} strokeLinecap="round" fill="none">
          <path d="M167,112 C162,126 158,138 169,150" strokeWidth="13" />
          <path d="M169,151 c-7,1 -11,3 -13,6" strokeWidth="6" />
          <path d="M169,151 c5,2 9,4 11,7" strokeWidth="6" />
        </g>

        <g className="cham-breathe">
          {/* 背稜（ノコギリ状のクレスト） */}
          <path
            d="M84,54 L90,44 L97,53 L105,44 L113,52 L122,45 L131,53 L140,47 L149,55 L158,51 L167,59"
            fill="none"
            strokeLinejoin="round"
            strokeWidth="2"
            style={{ stroke: pal.accent, transition: trans }}
          />
          <path
            d="M84,54 L90,44 L97,53 L105,44 L113,52 L122,45 L131,53 L140,47 L149,55 L158,51 L167,59 L160,60 L100,56 Z"
            style={{ fill: pal.accent, transition: trans }}
            opacity="0.9"
          />

          {/* カスク（兜状の頭頂：後方へ反り上がる三角稜） */}
          <path
            d="M213,68 C209,52 202,40 188,38 C176,40 168,56 165,72 C180,67 198,68 213,68 Z"
            style={{ fill: pal.deep, transition: trans }}
          />
          <path
            d="M213,68 C209,52 202,40 188,38"
            fill="none"
            strokeWidth="2.2"
            strokeLinecap="round"
            style={{ stroke: pal.accent, transition: trans, opacity: 0.85 }}
          />

          {/* ボディ（マーブル） */}
          <g clipPath={`url(#body-${id})`}>
            <rect x="0" y="0" width={VB_W} height={VB_H} style={{ fill: pal.mid, transition: trans }} />
            <path
              d="M40,108 C80,96 120,118 160,104 C200,90 230,112 250,104 L250,150 L40,150 Z"
              style={{ fill: pal.deep, transition: trans }}
            />
            <path
              d="M40,86 C80,74 118,98 158,84 C198,70 228,92 250,82 L250,98 C228,108 198,86 158,100 C118,114 80,90 40,100 Z"
              style={{ fill: pal.accent, transition: trans }}
            />
            <path
              d="M44,64 C84,54 120,76 160,62 C200,48 228,68 252,58 L252,72 C228,84 200,64 160,78 C120,92 84,70 44,80 Z"
              style={{ fill: pal.light, transition: trans }}
            />
            <path
              d="M48,80 C88,70 124,90 164,76"
              fill="none"
              strokeWidth="3"
              strokeLinecap="round"
              style={{ stroke: pal.wisp, transition: trans, opacity: 0.8 }}
            />
            <path
              d="M58,104 C96,96 132,112 170,100"
              fill="none"
              strokeWidth="2.2"
              strokeLinecap="round"
              style={{ stroke: pal.wisp, transition: trans, opacity: 0.55 }}
            />
          </g>

          {/* 口（採色中は開く） */}
          {phase === "grabbing" ? (
            <path d="M229,95 L205,90 Q200,96 206,103 Z" fill="#3A1614" />
          ) : (
            <path
              d="M229,96 C218,99 210,100 202,99"
              fill="none"
              strokeWidth="2.4"
              strokeLinecap="round"
              style={{ stroke: pal.deep, transition: trans }}
            />
          )}

          {/* 砲塔状の目 */}
          <g>
            <circle cx={eyeCx} cy={eyeCy} r="17" style={{ fill: pal.mid, transition: trans }} />
            <circle cx={eyeCx} cy={eyeCy} r="17" fill="none" strokeWidth="2.4" style={{ stroke: pal.deep, transition: trans }} />
            <circle cx={eyeCx} cy={eyeCy} r="10.5" style={{ fill: pal.light, transition: trans }} />
            {blink ? (
              <circle cx={eyeCx} cy={eyeCy} r="11" style={{ fill: pal.mid, transition: trans }} />
            ) : (
              <>
                <circle cx={eyeCx} cy={eyeCy} r="6.4" fill="#F8F4E8" />
                <circle cx={eyeCx + lookX} cy={eyeCy + lookY} r="3.6" fill="#16201A" />
                <circle cx={eyeCx + lookX - 1.2} cy={eyeCy + lookY - 1.4} r="1.2" fill="#F8F4E8" />
              </>
            )}
          </g>
        </g>
      </svg>
    </div>
  );
}

export { MOUTH_PX, PX_W, PX_H };
