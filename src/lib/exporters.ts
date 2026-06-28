import type { Swatch } from "../store/usePaletteStore";
import { nearestColorName } from "./colorName";

/**
 * 各色に一意な識別子（romaji 由来のスラグ）を割り当てる。
 * 近い伝統色の romaji を基にし、衝突したら -2, -3 … と連番を付ける。
 */
export function buildNames(colors: Swatch[]): string[] {
  const seen = new Map<string, number>();
  return colors.map((c) => {
    const base =
      (nearestColorName(c.rgb).color.romaji || "color")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "color";
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  });
}

/** CSS カスタムプロパティ（:root 内の --name: #hex;）。 */
export function toCssVars(colors: Swatch[]): string {
  const names = buildNames(colors);
  const lines = colors.map((c, i) => `  --${names[i]}: ${c.hex};`);
  return `:root {\n${lines.join("\n")}\n}\n`;
}

/** JSON 配列（{ name, hex, rgb:[r,g,b] }）。デザインツールやスクリプト取り込み用。 */
export function toJson(colors: Swatch[]): string {
  const names = buildNames(colors);
  const arr = colors.map((c, i) => ({
    name: names[i],
    hex: c.hex,
    rgb: [c.rgb.r, c.rgb.g, c.rgb.b],
  }));
  return JSON.stringify(arr, null, 2);
}

/** 横並びスウォッチ帯の SVG（Figma はペーストした SVG テキストを図形として解釈できる）。 */
export function toSvg(colors: Swatch[]): string {
  const cell = 96;
  const labelH = 22;
  const w = cell * colors.length;
  const h = cell + labelH;
  const names = buildNames(colors);
  const rects = colors
    .map((c, i) => {
      const x = i * cell;
      const tx = x + cell / 2;
      return (
        `  <rect x="${x}" y="0" width="${cell}" height="${cell}" fill="${c.hex}"/>\n` +
        `  <text x="${tx}" y="${cell + 15}" font-family="monospace" font-size="11" ` +
        `text-anchor="middle" fill="#222">${c.hex}</text>\n` +
        `  <!-- ${names[i]} -->`
      );
    })
    .join("\n");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">\n` +
    `${rects}\n</svg>\n`
  );
}

/**
 * Adobe Swatch Exchange (.ase) バイナリを生成。
 * 構造: "ASEF" + version(1.0) + blockCount(u32) +
 *   各色ブロック: type(u16=0x0001) + length(u32) +
 *     [ nameLen(u16, 終端NUL含む) + name(UTF-16BE) + NUL,
 *       "RGB ", 3×float32BE(0–1), colorType(u16=0x0002 global) ]
 */
export function toAseBlob(colors: Swatch[], names: string[]): Blob {
  const blocks: ArrayBuffer[] = [];

  for (let i = 0; i < colors.length; i++) {
    const name = names[i];
    const nameChars = name.length + 1; // 終端NUL込み
    // body: nameLen(2) + name(2*nameChars) + "RGB "(4) + 3*float(12) + type(2)
    const bodyLen = 2 + nameChars * 2 + 4 + 12 + 2;
    const buf = new ArrayBuffer(6 + bodyLen); // type(2)+length(4)+body
    const dv = new DataView(buf);
    let o = 0;
    dv.setUint16(o, 0x0001); // block type: color entry
    o += 2;
    dv.setUint32(o, bodyLen); // block length (body bytes)
    o += 4;
    dv.setUint16(o, nameChars); // name length in UTF-16 units (incl. NUL)
    o += 2;
    for (let k = 0; k < name.length; k++) {
      dv.setUint16(o, name.charCodeAt(k));
      o += 2;
    }
    dv.setUint16(o, 0); // NUL terminator
    o += 2;
    // color model "RGB " (trailing space)
    const model = "RGB ";
    for (let k = 0; k < 4; k++) {
      dv.setUint8(o, model.charCodeAt(k));
      o += 1;
    }
    const c = colors[i];
    dv.setFloat32(o, c.rgb.r / 255);
    o += 4;
    dv.setFloat32(o, c.rgb.g / 255);
    o += 4;
    dv.setFloat32(o, c.rgb.b / 255);
    o += 4;
    dv.setUint16(o, 0x0002); // color type: global
    o += 2;
    blocks.push(buf);
  }

  // header: "ASEF"(4) + version major(u16=1)+minor(u16=0) + blockCount(u32)
  const header = new ArrayBuffer(12);
  const hv = new DataView(header);
  "ASEF".split("").forEach((ch, k) => hv.setUint8(k, ch.charCodeAt(0)));
  hv.setUint16(4, 1); // version major
  hv.setUint16(6, 0); // version minor
  hv.setUint32(8, blocks.length);

  return new Blob([header, ...blocks], { type: "application/octet-stream" });
}

/** Blob をダウンロード（Web Share 対応端末はファイル共有を試み、不可ならアンカー保存）。 */
export async function downloadBlob(blob: Blob, filename: string): Promise<boolean> {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return true;
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return true; // ユーザーが閉じただけ
      // それ以外はアンカー保存へフォールバック
    }
  }
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}
