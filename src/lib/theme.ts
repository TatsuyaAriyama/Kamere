import type { Swatch } from "../store/usePaletteStore";
import { contrastRatio, hexToRgb, relLuminance, rgbToOklch } from "./color";

/** UIの意味役割。採った色をこの役割へ割り当ててデザインを組む。 */
export type ThemeRoles = {
  bg: string; // 画面ベース
  surface: string; // カード・バー
  primary: string; // 主要ボタン・強調
  accent: string; // 差し色
  text: string; // 本文
};
export type RoleKey = keyof ThemeRoles;

export const ROLE_META: { key: RoleKey; label: string; hint: string }[] = [
  { key: "bg", label: "背景", hint: "画面のベース" },
  { key: "surface", label: "面", hint: "カード・バー" },
  { key: "primary", label: "主役", hint: "主要ボタン・強調" },
  { key: "accent", label: "アクセント", hint: "補助の差し色" },
  { key: "text", label: "文字", hint: "本文の色" },
];

const NEAR_BLACK = "#141414";
const WHITE = "#FFFFFF";

/** 背景色に対し読みやすい文字色（白/近黒）をコントラスト比で選ぶ。 */
export function bestOn(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return NEAR_BLACK;
  const black = hexToRgb(NEAR_BLACK)!;
  const white = hexToRgb(WHITE)!;
  return contrastRatio(rgb, white) >= contrastRatio(rgb, black) ? WHITE : NEAR_BLACK;
}

function hueDist(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** 採った色のない既定テーマ（落ち着いた中立色）。 */
export const DEFAULT_ROLES: ThemeRoles = {
  bg: "#F7F5EF",
  surface: "#FFFFFF",
  primary: "#1B813E",
  accent: "#DC9FB4",
  text: "#141414",
};

/**
 * パレットから役割を自動割り当て。
 * 最も明るい色を背景、最も暗い色を文字に。残りから彩度の高い色を主役、
 * 主役と色相が離れた彩度色をアクセント、明るめの残色を面に当てる。
 */
export function autoAssignRoles(colors: Swatch[]): ThemeRoles {
  if (colors.length === 0) return { ...DEFAULT_ROLES };

  const items = colors.map((c) => {
    const { L, C, h } = rgbToOklch(c.rgb);
    return { hex: c.hex, lum: relLuminance(c.rgb), chroma: C, hue: h, okL: L };
  });

  const byLum = [...items].sort((a, b) => b.lum - a.lum);
  const bg = byLum[0].hex;
  const text = byLum[byLum.length - 1].hex;

  // 面: 背景と文字を除いた中で最も明るい色。候補が無ければ背景を流用。
  const rest = byLum.filter((x) => x.hex !== bg && x.hex !== text);
  const surface = rest.find((x) => x.lum > 0.6)?.hex ?? rest[0]?.hex ?? bg;

  // 彩度候補（背景・文字を除く）。
  const chroma = [...rest].sort((a, b) => b.chroma - a.chroma);
  const primary = chroma[0]?.hex ?? byLum[Math.floor(byLum.length / 2)].hex;
  const pHue = items.find((x) => x.hex === primary)?.hue ?? 0;

  // アクセント: 主役と色相の離れた彩度色を優先。
  const accent =
    chroma.find((x) => x.hex !== primary && hueDist(x.hue, pHue) > 40)?.hex ??
    chroma.find((x) => x.hex !== primary)?.hex ??
    primary;

  return { bg, surface, primary, accent, text };
}

/** テーマをデザイントークン（CSS変数）へ。文字反転色（on-*）も含める。 */
export function toThemeCss(roles: ThemeRoles): string {
  const lines = [
    `  --color-bg: ${roles.bg};`,
    `  --color-surface: ${roles.surface};`,
    `  --color-text: ${roles.text};`,
    `  --color-primary: ${roles.primary};`,
    `  --color-on-primary: ${bestOn(roles.primary)};`,
    `  --color-accent: ${roles.accent};`,
    `  --color-on-accent: ${bestOn(roles.accent)};`,
  ];
  return `:root {\n${lines.join("\n")}\n}\n`;
}
