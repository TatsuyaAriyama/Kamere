import type { RGB } from "./color";

type Pixel = [number, number, number];

function channelRanges(box: Pixel[]): [number, number, number, number, number, number] {
  let r0 = 255,
    r1 = 0,
    g0 = 255,
    g1 = 0,
    b0 = 255,
    b1 = 0;
  for (const p of box) {
    if (p[0] < r0) r0 = p[0];
    if (p[0] > r1) r1 = p[0];
    if (p[1] < g0) g0 = p[1];
    if (p[1] > g1) g1 = p[1];
    if (p[2] < b0) b0 = p[2];
    if (p[2] > b1) b1 = p[2];
  }
  return [r0, r1, g0, g1, b0, b1];
}

function average(box: Pixel[]): RGB {
  let r = 0,
    g = 0,
    b = 0;
  for (const p of box) {
    r += p[0];
    g += p[1];
    b += p[2];
  }
  const n = box.length;
  return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
}

/**
 * 画像全体から代表色を抽出（メディアンカット法）。
 * 最も色幅の広い箱をその軸の中央値で分割、count個になるまで繰り返す。
 * 返り値はピクセル数の多い順（＝画面で支配的な色から）。
 */
export function extractPalette(img: ImageData, count = 6): RGB[] {
  const { data } = img;
  const pixels: Pixel[] = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 125) continue; // 透明はスキップ
    pixels.push([data[i], data[i + 1], data[i + 2]]);
  }
  if (pixels.length === 0) return [];

  let boxes: Pixel[][] = [pixels];
  while (boxes.length < count) {
    let bi = -1;
    let bestRange = -1;
    let bestCh = 0;
    for (let k = 0; k < boxes.length; k++) {
      const b = boxes[k];
      if (b.length < 2) continue;
      const [r0, r1, g0, g1, b0, b1] = channelRanges(b);
      const rr = r1 - r0;
      const gr = g1 - g0;
      const br = b1 - b0;
      const m = Math.max(rr, gr, br);
      if (m > bestRange) {
        bestRange = m;
        bi = k;
        bestCh = rr === m ? 0 : gr === m ? 1 : 2;
      }
    }
    if (bi < 0) break; // これ以上分割できない
    const box = boxes[bi];
    box.sort((p, q) => p[bestCh] - q[bestCh]);
    const mid = box.length >> 1;
    boxes.splice(bi, 1, box.slice(0, mid), box.slice(mid));
  }

  return boxes
    .map((b) => ({ rgb: average(b), n: b.length }))
    .sort((a, b) => b.n - a.n)
    .map((x) => x.rgb);
}
