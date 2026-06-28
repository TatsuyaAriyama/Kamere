import type { RGB } from "./color";

export type Fit = "cover" | "contain";

export type Rect = { x: number; y: number; w: number; h: number };

/** 任意のソース要素（video / img / canvas）。drawImage可能なもの。 */
export type Drawable = CanvasImageSource & { readonly width?: number };

/**
 * コンテナ(CSS px)内で object-fit に従いメディアが実際に描画される矩形を返す。
 * 返り値はコンテナ左上を原点とする CSS px。
 */
export function getDisplayedRect(
  containerW: number,
  containerH: number,
  naturalW: number,
  naturalH: number,
  fit: Fit,
): Rect {
  if (naturalW <= 0 || naturalH <= 0 || containerW <= 0 || containerH <= 0) {
    return { x: 0, y: 0, w: containerW, h: containerH };
  }
  const scaleCover = Math.max(containerW / naturalW, containerH / naturalH);
  const scaleContain = Math.min(containerW / naturalW, containerH / naturalH);
  const scale = fit === "cover" ? scaleCover : scaleContain;
  const w = naturalW * scale;
  const h = naturalH * scale;
  return { x: (containerW - w) / 2, y: (containerH - h) / 2, w, h };
}

/**
 * メディアの bounding rect(viewport CSS px) と自然サイズから、
 * viewport座標(clientX/clientY)を「メディアの自然ピクセル座標」に変換する。
 * メディア描画範囲外なら null（レターボックス/映像外の無効判定）。
 *
 * 画面 devicePixelRatio はここに一切入らない（CSS px と自然px のみで完結）→ 高dprでもズレない。
 */
export function clientToMediaPixel(
  mediaRect: DOMRect,
  naturalW: number,
  naturalH: number,
  fit: Fit,
  clientX: number,
  clientY: number,
): { mx: number; my: number } | null {
  const localX = clientX - mediaRect.left;
  const localY = clientY - mediaRect.top;
  const disp = getDisplayedRect(mediaRect.width, mediaRect.height, naturalW, naturalH, fit);

  if (
    localX < disp.x ||
    localX > disp.x + disp.w ||
    localY < disp.y ||
    localY > disp.y + disp.h
  ) {
    return null;
  }

  const fracX = (localX - disp.x) / disp.w;
  const fracY = (localY - disp.y) / disp.h;
  const mx = Math.min(naturalW - 1, Math.max(0, Math.floor(fracX * naturalW)));
  const my = Math.min(naturalH - 1, Math.max(0, Math.floor(fracY * naturalH)));
  return { mx, my };
}

// 1×1 抽出用の使い回しキャンバス（GC負荷を避ける）
let pixelCanvas: HTMLCanvasElement | null = null;
let pixelCtx: CanvasRenderingContext2D | null = null;

function getPixelCtx(): CanvasRenderingContext2D | null {
  if (!pixelCtx) {
    pixelCanvas = document.createElement("canvas");
    pixelCanvas.width = 1;
    pixelCanvas.height = 1;
    pixelCtx = pixelCanvas.getContext("2d", { willReadFrequently: true });
  }
  return pixelCtx;
}

/**
 * ソースの1ピクセルだけを1×1キャンバスへ写し取り色を読む。
 * フレーム全体を描かないので大解像度でも軽量、かつ dpr 非依存。
 */
export function sampleSourcePixel(source: Drawable, mx: number, my: number): RGB | null {
  const ctx = getPixelCtx();
  if (!ctx) return null;
  try {
    ctx.clearRect(0, 0, 1, 1);
    ctx.drawImage(source, mx, my, 1, 1, 0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    if (d[3] === 0) return null;
    return { r: d[0], g: d[1], b: d[2] };
  } catch {
    // CORS汚染など。MVPでは無効として扱う。
    return null;
  }
}

// 近傍平均用キャンバス（使い回し）。
let areaCanvas: HTMLCanvasElement | null = null;
let areaCtx: CanvasRenderingContext2D | null = null;
const AREA = 5; // 平均する一辺のソースpx数（5×5）

function getAreaCtx(): CanvasRenderingContext2D | null {
  if (!areaCtx) {
    areaCanvas = document.createElement("canvas");
    areaCanvas.width = AREA;
    areaCanvas.height = AREA;
    areaCtx = areaCanvas.getContext("2d", { willReadFrequently: true });
  }
  return areaCtx;
}

const toLinear = (c: number) => {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
};
const toSrgb = (c: number) => {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(v * 255)));
};

/**
 * 指定ソースpxを中心に AREA×AREA を切り出し、線形光で加重平均した代表色を返す。
 * 中心寄りのガウシアン重みでエッジ跨ぎの混色を抑える。単一pxよりノイズに強く、
 * 「実際に見えている色」に近い安定した値が得られる。
 */
export function sampleSourceArea(source: Drawable, mx: number, my: number): RGB | null {
  const ctx = getAreaCtx();
  if (!ctx) return null;
  const half = (AREA - 1) / 2;
  try {
    ctx.clearRect(0, 0, AREA, AREA);
    ctx.drawImage(source, mx - half, my - half, AREA, AREA, 0, 0, AREA, AREA);
    const data = ctx.getImageData(0, 0, AREA, AREA).data;
    let rl = 0,
      gl = 0,
      bl = 0,
      wsum = 0;
    const sigma2 = 2 * (half * 0.85) ** 2;
    for (let y = 0; y < AREA; y++) {
      for (let x = 0; x < AREA; x++) {
        const i = (y * AREA + x) * 4;
        if (data[i + 3] === 0) continue; // 透明はスキップ
        const dx = x - half;
        const dy = y - half;
        const w = Math.exp(-(dx * dx + dy * dy) / sigma2);
        rl += toLinear(data[i]) * w;
        gl += toLinear(data[i + 1]) * w;
        bl += toLinear(data[i + 2]) * w;
        wsum += w;
      }
    }
    if (wsum === 0) return null;
    return { r: toSrgb(rl / wsum), g: toSrgb(gl / wsum), b: toSrgb(bl / wsum) };
  } catch {
    return null;
  }
}

/**
 * ソースの現フレーム/画像を最大 maxDim に縮小して ImageData を返す。
 * 配色抽出（全体クラスタリング）用。CORS汚染や未準備時は null。
 */
export function drawSnapshot(
  source: Drawable,
  naturalW: number,
  naturalH: number,
  maxDim: number,
): ImageData | null {
  if (naturalW <= 0 || naturalH <= 0) return null;
  const scale = Math.min(1, maxDim / Math.max(naturalW, naturalH));
  const w = Math.max(1, Math.round(naturalW * scale));
  const h = Math.max(1, Math.round(naturalH * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  try {
    ctx.drawImage(source, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
  } catch {
    return null;
  }
}

/**
 * viewport座標で指定した点の色をソースからサンプリング。範囲外は null。
 */
export function sampleAtClient(
  source: Drawable,
  mediaRect: DOMRect,
  naturalW: number,
  naturalH: number,
  fit: Fit,
  clientX: number,
  clientY: number,
): RGB | null {
  const p = clientToMediaPixel(mediaRect, naturalW, naturalH, fit, clientX, clientY);
  if (!p) return null;
  return sampleSourcePixel(source, p.mx, p.my);
}

/** sampleAtClient のエリア平均版。採色確定時に使い、ノイズに強い代表色を得る。 */
export function sampleAreaAtClient(
  source: Drawable,
  mediaRect: DOMRect,
  naturalW: number,
  naturalH: number,
  fit: Fit,
  clientX: number,
  clientY: number,
): RGB | null {
  const p = clientToMediaPixel(mediaRect, naturalW, naturalH, fit, clientX, clientY);
  if (!p) return null;
  return sampleSourceArea(source, p.mx, p.my);
}
