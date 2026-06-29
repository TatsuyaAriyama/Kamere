import type { InspoCard } from "../store/useInspoStore";

/** インスピカードを「写真＋配色」の1枚の縦長カード画像(PNG Blob)に描き出す。 */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
  return t + "…";
}

function fmtDate(at: number): string {
  return new Date(at).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
}

export async function renderInspoCard(card: InspoCard, photo: string | null): Promise<Blob | null> {
  const W = 1080;
  const P = 64;
  const photoW = W - 2 * P;
  const photoH = Math.round(photoW * 0.75);
  const barH = 92;
  const note = (card.note ?? "").trim();

  // レイアウト（縦方向の基準線を順に算出）
  const photoY = P;
  const barY = photoY + photoH + 44;
  const hexBaseline = barY + barH + 50;
  const noteBaseline = note ? hexBaseline + 56 : hexBaseline;
  const footerBaseline = noteBaseline + 64;
  const H = footerBaseline + 48;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // フォント反映待ち（埋め込みフォントで描画）
  try {
    await (document.fonts?.ready ?? Promise.resolve());
  } catch {
    /* noop */
  }

  // 背景（紙）
  ctx.fillStyle = "#EDE7D9";
  ctx.fillRect(0, 0, W, H);

  // 写真
  let img: HTMLImageElement | null = null;
  if (photo) {
    try {
      img = await loadImage(photo);
    } catch {
      img = null;
    }
  }
  if (img) {
    ctx.save();
    roundRectPath(ctx, P, photoY, photoW, photoH, 28);
    ctx.clip();
    drawCover(ctx, img, P, photoY, photoW, photoH);
    ctx.restore();
  } else {
    ctx.fillStyle = "#DFD8C8";
    roundRectPath(ctx, P, photoY, photoW, photoH, 28);
    ctx.fill();
  }

  // 配色バー
  ctx.save();
  roundRectPath(ctx, P, barY, photoW, barH, 16);
  ctx.clip();
  const n = card.palette.length || 1;
  const seg = photoW / n;
  card.palette.forEach((s, i) => {
    ctx.fillStyle = s.hex;
    ctx.fillRect(P + seg * i, barY, Math.ceil(seg) + 1, barH);
  });
  ctx.restore();

  // HEX ラベル（各セグメント中央）
  ctx.fillStyle = "#1C1F1B";
  ctx.font = '700 22px "Space Mono", ui-monospace, monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  card.palette.forEach((s, i) => {
    ctx.fillText(s.hex, P + seg * (i + 0.5), hexBaseline);
  });

  // メモ
  if (note) {
    ctx.fillStyle = "#4A4636";
    ctx.font = '500 28px "Zen Maru Gothic", system-ui, sans-serif';
    ctx.textAlign = "center";
    ctx.fillText(truncate(ctx, note, photoW), W / 2, noteBaseline);
  }

  // フッター（ブランド＋日付）
  ctx.fillStyle = "#1C1F1B";
  ctx.textAlign = "left";
  ctx.font = '700 30px "Zen Maru Gothic", system-ui, sans-serif';
  ctx.fillText("カメレ", P, footerBaseline);
  ctx.fillStyle = "#7A7560";
  ctx.textAlign = "right";
  ctx.font = '400 24px "Space Mono", ui-monospace, monospace';
  ctx.fillText(fmtDate(card.at), W - P, footerBaseline);

  return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

export type CardExportResult = "shared" | "downloaded" | "failed";

/** カード画像を共有（対応端末）またはダウンロードで保存。 */
export async function exportInspoCardImage(card: InspoCard, photo: string | null): Promise<CardExportResult> {
  const blob = await renderInspoCard(card, photo);
  if (!blob) return "failed";
  const name = `kamere-${card.id.slice(0, 8)}.png`;

  try {
    const file = new File([blob], name, { type: "image/png" });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (typeof nav.canShare === "function" && nav.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: "カメレのインスピ" });
      return "shared";
    }
  } catch (err) {
    if ((err as DOMException)?.name === "AbortError") return "shared";
    // 共有不可ならダウンロードへフォールバック
  }

  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return "downloaded";
  } catch {
    return "failed";
  }
}
