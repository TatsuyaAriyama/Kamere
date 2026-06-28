import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePaletteStore } from "../../store/usePaletteStore";
import { useToastStore } from "../../store/useToastStore";
import { downloadBlob } from "../../lib/exporters";
import { hexToRgb, rgbToHex } from "../../lib/color";

type Props = {
  onClose: () => void;
};

type Tool = "pen" | "line" | "rect" | "ellipse" | "fill" | "eyedropper" | "eraser";

const BG = "#FFFFFF";
const BLACK = "#141414";
const ART_KEY = "kamere.art.v1";
const MIN_SIZE = 1;
const MAX_SIZE = 48;
const DEFAULT_SIZE = 12;
const PREVIEW_MAX = 30; // 太さプレビューの最大表示直径
const MAX_UNDO = 24;
const DEFAULT_TOLERANCE = 40; // 塗りつぶしの色一致しきい値（チャンネル差）の初期値

type Pt = { x: number; y: number };

export default function DrawMode({ onClose }: Props) {
  const colors = usePaletteStore((s) => s.colors);
  const history = usePaletteStore((s) => s.history);
  const favorites = usePaletteStore((s) => s.favorites);
  const lastColor = usePaletteStore((s) => s.lastColor);
  const toggleFavorite = usePaletteStore((s) => s.toggleFavorite);
  const clearHistory = usePaletteStore((s) => s.clearHistory);
  const showToast = useToastStore((s) => s.show);

  // 現在のパレット＋過去に採取した履歴を hex で統合（重複除去・採取順）。
  const captured = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of history) map.set(c.hex.toUpperCase(), c.hex);
    for (const c of colors) map.set(c.hex.toUpperCase(), c.hex);
    return [...map.values()];
  }, [history, colors]);

  const favSet = useMemo(() => new Set(favorites.map((h) => h.toUpperCase())), [favorites]);

  // 絵の具の並び: 黒 → お気に入り → 残りの採取色（重複除去）。
  const swatches = useMemo(() => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const hex of [BLACK, ...favorites, ...captured]) {
      const k = hex.toUpperCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(hex);
    }
    return out;
  }, [favorites, captured]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const dprRef = useRef(1);
  const cssSizeRef = useRef({ w: 0, h: 0 }); // CSSピクセルでのキャンバス寸法（ミラー軸計算用）
  const drawingRef = useRef(false);
  const lastPtRef = useRef<Pt | null>(null);
  const startPtRef = useRef<Pt | null>(null);
  const baseSnapRef = useRef<ImageData | null>(null); // 図形プレビュー用の確定状態
  const undoRef = useRef<ImageData[]>([]);
  const redoRef = useRef<ImageData[]>([]);
  const confirmTimer = useRef<number | undefined>(undefined);

  const [color, setColor] = useState<string>(lastColor ?? BLACK);
  const [size, setSize] = useState<number>(DEFAULT_SIZE);
  const [opacity, setOpacity] = useState(100); // %
  const [tool, setTool] = useState<Tool>("pen");
  const [shapeFill, setShapeFill] = useState(false); // 図形を塗りつぶすか（枠線か）
  const [tolerance, setTolerance] = useState(DEFAULT_TOLERANCE); // バケツの許容値
  const [mirror, setMirror] = useState(false); // 左右対称（ミラー）描画
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [confirmHist, setConfirmHist] = useState(false);
  const [allOpen, setAllOpen] = useState(false); // 採取色をすべて表示するシート
  const [sheetFilter, setSheetFilter] = useState<"all" | "fav">("all");

  const eraser = tool === "eraser";
  const alpha = opacity / 100;
  const isFav = !eraser && favSet.has(color.toUpperCase());

  // ── キャンバス初期化（DPR対応 + 保存画の復元） ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    dprRef.current = dpr;
    cssSizeRef.current = { w: rect.width, h: rect.height };
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctxRef.current = ctx;

    const saved = localStorage.getItem(ART_KEY);
    if (saved) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = saved;
    }
  }, []);

  // Escで閉じる（シートが開いていれば先に閉じる）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // アンマウント時にタイマー掃除
  useEffect(() => () => window.clearTimeout(confirmTimer.current), []);

  const persist = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      localStorage.setItem(ART_KEY, canvas.toDataURL("image/png"));
    } catch {
      /* 容量超過などは無視（描画は継続） */
    }
  }, []);

  const snapshot = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return null;
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }, []);

  const restore = useCallback((snap: ImageData) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // putImageDataは実ピクセル座標
    ctx.putImageData(snap, 0, 0);
    ctx.restore();
  }, []);

  // 新しい操作の前に呼ぶ。やり直しスタックは破棄。
  const pushUndo = useCallback(() => {
    const snap = snapshot();
    if (!snap) return;
    undoRef.current.push(snap);
    if (undoRef.current.length > MAX_UNDO) undoRef.current.shift();
    redoRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, [snapshot]);

  const pointFromEvent = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  // 描画スタイルを現在の道具・色・不透明度で設定。
  const applyStroke = (ctx: CanvasRenderingContext2D) => {
    ctx.globalAlpha = eraser ? 1 : alpha;
    const c = eraser ? BG : color;
    ctx.strokeStyle = c;
    ctx.fillStyle = c;
    ctx.lineWidth = size;
  };

  // 左右対称の軸で点を反転。
  const mirrorPt = (p: Pt): Pt => ({ x: cssSizeRef.current.w - p.x, y: p.y });

  const drawDab = (ctx: CanvasRenderingContext2D, p: Pt) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, size / 2, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawSeg = (ctx: CanvasRenderingContext2D, a: Pt, b: Pt) => {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  };

  const drawShape = (ctx: CanvasRenderingContext2D, start: Pt, p: Pt) => {
    if (tool === "line") {
      drawSeg(ctx, start, p);
    } else if (tool === "rect") {
      const x = Math.min(start.x, p.x);
      const y = Math.min(start.y, p.y);
      const w = Math.abs(p.x - start.x);
      const h = Math.abs(p.y - start.y);
      if (shapeFill) ctx.fillRect(x, y, w, h);
      else ctx.strokeRect(x, y, w, h);
    } else if (tool === "ellipse") {
      ctx.beginPath();
      ctx.ellipse(
        (start.x + p.x) / 2,
        (start.y + p.y) / 2,
        Math.abs(p.x - start.x) / 2,
        Math.abs(p.y - start.y) / 2,
        0,
        0,
        Math.PI * 2,
      );
      if (shapeFill) ctx.fill();
      else ctx.stroke();
    }
  };

  // キャンバスから色を採る（スポイト）。
  const pickFromCanvas = (p: Pt) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const dpr = dprRef.current;
    const x = Math.floor(p.x * dpr);
    const y = Math.floor(p.y * dpr);
    const d = ctx.getImageData(x, y, 1, 1).data;
    const hex = rgbToHex({ r: d[0], g: d[1], b: d[2] });
    setColor(hex);
    setTool("pen");
    showToast(`色を採りました ${hex}`);
  };

  // 連続領域を塗りつぶす（スキャンライン + 不透明度合成）。
  const floodFill = (p: Pt) => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    const dpr = dprRef.current;
    const W = canvas.width;
    const H = canvas.height;
    const sx = Math.floor(p.x * dpr);
    const sy = Math.floor(p.y * dpr);
    if (sx < 0 || sy < 0 || sx >= W || sy >= H) return;

    const img = ctx.getImageData(0, 0, W, H);
    const data = img.data;
    const si = (sy * W + sx) * 4;
    const tr = data[si];
    const tg = data[si + 1];
    const tb = data[si + 2];
    const ta = data[si + 3];

    const fc = hexToRgb(eraser ? BG : color) ?? { r: 0, g: 0, b: 0 };
    const fa = eraser ? 1 : alpha;
    const seen = new Uint8Array(W * H);

    const matches = (idx: number) => {
      if (seen[idx]) return false;
      const i = idx * 4;
      return (
        Math.abs(data[i] - tr) <= tolerance &&
        Math.abs(data[i + 1] - tg) <= tolerance &&
        Math.abs(data[i + 2] - tb) <= tolerance &&
        Math.abs(data[i + 3] - ta) <= tolerance
      );
    };

    const paint = (idx: number) => {
      seen[idx] = 1;
      const i = idx * 4;
      data[i] = Math.round(fc.r * fa + data[i] * (1 - fa));
      data[i + 1] = Math.round(fc.g * fa + data[i + 1] * (1 - fa));
      data[i + 2] = Math.round(fc.b * fa + data[i + 2] * (1 - fa));
      data[i + 3] = Math.round(255 * fa + data[i + 3] * (1 - fa));
    };

    const stack: number[] = [sx, sy];
    while (stack.length) {
      const y = stack.pop()!;
      const x = stack.pop()!;
      let lx = x;
      while (lx >= 0 && matches(y * W + lx)) lx--;
      lx++;
      let spanUp = false;
      let spanDown = false;
      for (let cx = lx; cx < W && matches(y * W + cx); cx++) {
        paint(y * W + cx);
        if (y > 0) {
          const up = matches((y - 1) * W + cx);
          if (up && !spanUp) {
            stack.push(cx, y - 1);
            spanUp = true;
          } else if (!up) {
            spanUp = false;
          }
        }
        if (y < H - 1) {
          const dn = matches((y + 1) * W + cx);
          if (dn && !spanDown) {
            stack.push(cx, y + 1);
            spanDown = true;
          } else if (!dn) {
            spanDown = false;
          }
        }
      }
    }

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.putImageData(img, 0, 0);
    ctx.restore();
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const p = pointFromEvent(e);
    canvasRef.current?.setPointerCapture?.(e.pointerId);

    if (tool === "eyedropper") {
      pickFromCanvas(p);
      return;
    }
    if (tool === "fill") {
      pushUndo();
      floodFill(p);
      if (mirror) floodFill(mirrorPt(p));
      persist();
      return;
    }

    // 線・図形・ペン・消しゴム
    pushUndo();
    drawingRef.current = true;
    startPtRef.current = p;
    lastPtRef.current = p;
    if (tool === "pen" || tool === "eraser") {
      applyStroke(ctx);
      drawDab(ctx, p);
      if (mirror) drawDab(ctx, mirrorPt(p));
    } else {
      baseSnapRef.current = snapshot(); // 図形はプレビューのため確定状態を退避
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    const ctx = ctxRef.current;
    if (!ctx) return;
    const p = pointFromEvent(e);

    if (tool === "pen" || tool === "eraser") {
      const last = lastPtRef.current;
      if (!last) return;
      applyStroke(ctx);
      drawSeg(ctx, last, p);
      if (mirror) drawSeg(ctx, mirrorPt(last), mirrorPt(p));
      lastPtRef.current = p;
    } else {
      const base = baseSnapRef.current;
      const start = startPtRef.current;
      if (!base || !start) return;
      restore(base);
      applyStroke(ctx);
      drawShape(ctx, start, p);
      if (mirror) drawShape(ctx, mirrorPt(start), mirrorPt(p));
    }
  };

  const endStroke = (e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPtRef.current = null;
    startPtRef.current = null;
    baseSnapRef.current = null;
    const ctx = ctxRef.current;
    if (ctx) ctx.globalAlpha = 1;
    canvasRef.current?.releasePointerCapture?.(e.pointerId);
    persist();
  };

  const undo = () => {
    const snap = undoRef.current.pop();
    const cur = snapshot();
    if (!snap || !cur) return;
    redoRef.current.push(cur);
    if (redoRef.current.length > MAX_UNDO) redoRef.current.shift();
    restore(snap);
    setCanUndo(undoRef.current.length > 0);
    setCanRedo(true);
    persist();
  };

  const redo = () => {
    const snap = redoRef.current.pop();
    const cur = snapshot();
    if (!snap || !cur) return;
    undoRef.current.push(cur);
    if (undoRef.current.length > MAX_UNDO) undoRef.current.shift();
    restore(snap);
    setCanRedo(redoRef.current.length > 0);
    setCanUndo(true);
    persist();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    pushUndo();
    const rect = canvas.getBoundingClientRect();
    ctx.globalAlpha = 1;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, rect.width, rect.height);
    persist();
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) {
        showToast("保存に失敗しました");
        return;
      }
      void downloadBlob(blob, "kamere-art.png").then((ok) =>
        showToast(ok ? "絵を書き出し" : "保存に失敗しました"),
      );
    }, "image/png");
  };

  const pickColor = (hex: string) => {
    setColor(hex);
    if (tool === "eraser" || tool === "eyedropper") setTool("pen");
  };

  const pickFromSheet = (hex: string) => {
    pickColor(hex);
    setAllOpen(false);
  };

  const onToggleFavorite = () => {
    if (eraser) return;
    toggleFavorite(color);
    showToast(isFav ? "お気に入りから外しました" : "お気に入りに登録");
  };

  // 二度押しで履歴を消去（お気に入りは保持）。
  const onClearHistory = () => {
    if (!confirmHist) {
      setConfirmHist(true);
      confirmTimer.current = window.setTimeout(() => setConfirmHist(false), 2600);
      return;
    }
    window.clearTimeout(confirmTimer.current);
    setConfirmHist(false);
    clearHistory();
    showToast("採取履歴を消去（お気に入りは保持）");
  };

  const previewSize = Math.max(2, Math.min(size, PREVIEW_MAX));

  return (
    <div className="draw-mode" role="dialog" aria-label="お絵かきモード">
      <header className="dr-bar">
        <span className="dr-title">お絵かき</span>
        <div className="dr-bar-actions">
          <button type="button" className="dr-save" onClick={save}>
            保存
          </button>
          <button type="button" className="dr-close" aria-label="お絵かきを閉じる" onClick={onClose}>
            ×
          </button>
        </div>
      </header>

      <canvas
        ref={canvasRef}
        className="dr-canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
      />

      <div className="dr-tools">
        {/* ── 道具の選択 ── */}
        <div className="dr-toolbar" role="toolbar" aria-label="描画ツール">
          {TOOLS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`dr-toolbtn${tool === t.key ? " is-active" : ""}`}
              aria-pressed={tool === t.key}
              aria-label={t.label}
              title={t.label}
              onClick={() => setTool(t.key)}
            >
              {t.icon}
            </button>
          ))}
        </div>

        {/* ── 道具オプション（ミラー・図形の塗り・許容値） ── */}
        <div className="dr-options">
          <button
            type="button"
            className={`dr-opt-toggle${mirror ? " is-on" : ""}`}
            aria-pressed={mirror}
            aria-label="左右対称（ミラー）描画"
            onClick={() => setMirror((v) => !v)}
          >
            <span className="dr-opt-ico" aria-hidden>
              ▷◁
            </span>
            左右対称
          </button>

          {(tool === "rect" || tool === "ellipse") && (
            <div className="dr-seg" role="group" aria-label="図形のスタイル">
              <button
                type="button"
                className={`dr-seg-btn${!shapeFill ? " is-active" : ""}`}
                aria-pressed={!shapeFill}
                onClick={() => setShapeFill(false)}
              >
                枠
              </button>
              <button
                type="button"
                className={`dr-seg-btn${shapeFill ? " is-active" : ""}`}
                aria-pressed={shapeFill}
                onClick={() => setShapeFill(true)}
              >
                塗り
              </button>
            </div>
          )}

          {tool === "fill" && (
            <label className="dr-opt-range">
              許容値
              <input
                type="range"
                className="dr-size-range"
                min={0}
                max={120}
                step={5}
                value={tolerance}
                aria-label="塗りつぶしの許容値"
                onChange={(e) => setTolerance(Number(e.target.value))}
              />
              <span className="dr-size-val">{tolerance}</span>
            </label>
          )}
        </div>

        {/* ── 絵の具パレット ── */}
        <div className="dr-palette">
          <div className="dr-current">
            <span
              className={`dr-current-chip${eraser ? " is-eraser" : ""}`}
              style={eraser ? undefined : { background: color }}
              aria-hidden
            />
            <button
              type="button"
              className={`dr-fav${isFav ? " is-on" : ""}`}
              aria-pressed={isFav}
              aria-label={isFav ? "お気に入りから外す" : "この色をお気に入りに登録"}
              disabled={eraser}
              onClick={onToggleFavorite}
            >
              {isFav ? "★" : "☆"}
            </button>
          </div>

          <div className="dr-swatches" role="list" aria-label="絵の具（お気に入り・採取した色）">
            {swatches.map((hex, i) => {
              const up = hex.toUpperCase();
              const sel = !eraser && color.toUpperCase() === up;
              const fav = favSet.has(up);
              return (
                <button
                  key={`${hex}-${i}`}
                  type="button"
                  role="listitem"
                  className={`dr-swatch${sel ? " is-sel" : ""}${fav ? " is-fav" : ""}`}
                  style={{ background: hex }}
                  aria-label={`${hex} で描く${fav ? "（お気に入り）" : ""}`}
                  aria-pressed={sel}
                  onClick={() => pickColor(hex)}
                />
              );
            })}
          </div>

          {captured.length > 0 && (
            <button
              type="button"
              className="dr-expand"
              aria-label="採取した色をすべて表示"
              aria-expanded={allOpen}
              onClick={() => setAllOpen((v) => !v)}
            >
              すべて
              <span className="dr-expand-n">{captured.length}</span>
            </button>
          )}
        </div>

        {/* ── 筆の太さ ── */}
        <div className="dr-brush">
          <span className="dr-size-preview" aria-hidden>
            <span
              className="dr-size-dot"
              style={{
                width: previewSize,
                height: previewSize,
                background: eraser ? "#ccc" : color,
                opacity: eraser ? 1 : alpha,
              }}
            />
          </span>
          <input
            type="range"
            className="dr-size-range"
            min={MIN_SIZE}
            max={MAX_SIZE}
            step={1}
            value={size}
            aria-label="筆の太さ"
            onChange={(e) => setSize(Number(e.target.value))}
          />
          <span className="dr-size-val">{size}</span>
        </div>

        {/* ── 不透明度 ── */}
        <div className="dr-brush">
          <span className="dr-brush-label">透明度</span>
          <input
            type="range"
            className="dr-size-range"
            min={10}
            max={100}
            step={5}
            value={opacity}
            disabled={eraser}
            aria-label="不透明度"
            onChange={(e) => setOpacity(Number(e.target.value))}
          />
          <span className="dr-size-val">{opacity}</span>
        </div>

        {/* ── 操作 ── */}
        <div className="dr-actions-row">
          <button type="button" className="dr-tool" disabled={!canUndo} onClick={undo}>
            戻す
          </button>
          <button type="button" className="dr-tool" disabled={!canRedo} onClick={redo}>
            やり直し
          </button>
          <button type="button" className="dr-tool" onClick={clearCanvas}>
            全消し
          </button>
          <button
            type="button"
            className={`dr-tool danger${confirmHist ? " is-armed" : ""}`}
            disabled={captured.length === 0}
            onClick={onClearHistory}
          >
            {confirmHist ? "もう一度で消去" : "履歴を消す"}
          </button>
        </div>
      </div>

      {/* ── 採取色をすべて見るシート ── */}
      {allOpen && (
        <div className="dr-sheet" role="dialog" aria-label="採取した色から選ぶ">
          <div className="dr-sheet-head">
            <div className="dr-sheet-tabs" role="tablist" aria-label="色の絞り込み">
              <button
                type="button"
                role="tab"
                aria-selected={sheetFilter === "all"}
                className={`dr-tab${sheetFilter === "all" ? " is-active" : ""}`}
                onClick={() => setSheetFilter("all")}
              >
                すべて<span className="dr-tab-n">{captured.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={sheetFilter === "fav"}
                className={`dr-tab${sheetFilter === "fav" ? " is-active" : ""}`}
                onClick={() => setSheetFilter("fav")}
              >
                ★お気に入り<span className="dr-tab-n">{favorites.length}</span>
              </button>
            </div>
            <button
              type="button"
              className="dr-sheet-close"
              aria-label="閉じる"
              onClick={() => setAllOpen(false)}
            >
              ×
            </button>
          </div>
          {sheetFilter === "fav" && favorites.length === 0 ? (
            <p className="dr-sheet-empty">
              スウォッチを選んで <span className="dr-sheet-star">★</span>{" "}
              を押すと、お気に入りに登録。よく使う色がここに集まり、いつでも呼び出せます。
            </p>
          ) : (
            <div className="dr-grid" role="list">
              {(sheetFilter === "fav" ? favorites : swatches).map((hex, i) => {
                const up = hex.toUpperCase();
                const sel = !eraser && color.toUpperCase() === up;
                const fav = favSet.has(up);
                return (
                  <button
                    key={`g-${hex}-${i}`}
                    type="button"
                    role="listitem"
                    className="dr-grid-item"
                    aria-label={`${hex} で描く${fav ? "（お気に入り）" : ""}`}
                    aria-pressed={sel}
                    onClick={() => pickFromSheet(hex)}
                  >
                    <span
                      className={`dr-grid-sw${sel ? " is-sel" : ""}${fav ? " is-fav" : ""}`}
                      style={{ background: hex }}
                    />
                    <span className="dr-grid-hex">{hex.toUpperCase()}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 採った色が無いときの誘導（黒だけでも描ける） */}
      {captured.length === 0 && favorites.length === 0 && (
        <p className="dr-hint">
          カメラや写真から色を採ると、ここに絵の具として並びます。今は黒で描けます。
        </p>
      )}
    </div>
  );
}

/* ── ツール定義（アイコンは currentColor で塗る簡易SVG） ── */
const ICON = {
  stroke: {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  },
};

const TOOLS: { key: Tool; label: string; icon: ReactNode }[] = [
  {
    key: "pen",
    label: "ペン",
    icon: (
      <svg viewBox="0 0 20 20" width="18" height="18">
        <path {...ICON.stroke} d="M4 16l1-3 8-8 2 2-8 8-3 1z" />
        <path {...ICON.stroke} d="M12 5l3 3" />
      </svg>
    ),
  },
  {
    key: "line",
    label: "直線",
    icon: (
      <svg viewBox="0 0 20 20" width="18" height="18">
        <path {...ICON.stroke} d="M4 16L16 4" />
      </svg>
    ),
  },
  {
    key: "rect",
    label: "四角",
    icon: (
      <svg viewBox="0 0 20 20" width="18" height="18">
        <rect {...ICON.stroke} x="4" y="5" width="12" height="10" rx="1.5" />
      </svg>
    ),
  },
  {
    key: "ellipse",
    label: "丸",
    icon: (
      <svg viewBox="0 0 20 20" width="18" height="18">
        <circle {...ICON.stroke} cx="10" cy="10" r="6" />
      </svg>
    ),
  },
  {
    key: "fill",
    label: "塗りつぶし",
    icon: (
      <svg viewBox="0 0 20 20" width="18" height="18">
        <path {...ICON.stroke} d="M8 3l6 6-5 5a2 2 0 0 1-3 0L3 11z" />
        <path {...ICON.stroke} d="M8 3L6 5" />
        <path fill="currentColor" stroke="none" d="M16 17c1.2 0 2-.9 2-2 0-1-2-3-2-3s-2 2-2 3c0 1.1.8 2 2 2z" />
      </svg>
    ),
  },
  {
    key: "eyedropper",
    label: "スポイト",
    icon: (
      <svg viewBox="0 0 20 20" width="18" height="18">
        <path {...ICON.stroke} d="M13 3l4 4-2 2-4-4z" />
        <path {...ICON.stroke} d="M11 7l-6 6-1 4 4-1 6-6" />
      </svg>
    ),
  },
  {
    key: "eraser",
    label: "消しゴム",
    icon: (
      <svg viewBox="0 0 20 20" width="18" height="18">
        <path {...ICON.stroke} d="M4 14l6-6 5 5-3 3H7z" />
        <path {...ICON.stroke} d="M9 16h7" />
      </svg>
    ),
  },
];
