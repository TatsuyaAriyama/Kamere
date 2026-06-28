import type { RGB } from "../../lib/color";
import { hslToHex, rgbToHsl } from "../../lib/color";

/** マーブル各バンドの色。idle時はブランド配色、採色時は捕色の濃淡へ。 */
export type MarblePalette = {
  deep: string;
  mid: string;
  accent: string;
  light: string;
  wisp: string;
};

/** アイコン由来のブランド配色（青緑マーブル / 初期状態）。 */
export const BRAND_MARBLE: MarblePalette = {
  deep: "#1B3FA0",
  mid: "#2E5FC0",
  accent: "#2FA088",
  light: "#8FC59C",
  wisp: "#EFEADC",
};

/**
 * 捕まえた色を基準に、渦パターンを保ったまま全バンドを同系色の濃淡へ染める（ティントマーブル）。
 * 色相は概ね保持し、明度を振って深み/ハイライトを作る。
 */
export function marbleFromColor(rgb: RGB): MarblePalette {
  const { h, s, l } = rgbToHsl(rgb);
  const sat = Math.max(0.28, Math.min(0.92, s)); // 極端な無彩・過飽和を緩和
  return {
    deep: hslToHex({ h, s: Math.min(1, sat + 0.08), l: Math.max(0.16, l * 0.5) }),
    mid: hslToHex({ h, s: sat, l: Math.max(0.26, Math.min(0.6, l)) }),
    accent: hslToHex({ h: h + 16, s: sat, l: Math.max(0.3, Math.min(0.62, l * 0.95)) }),
    light: hslToHex({ h, s: Math.max(0.2, sat - 0.12), l: Math.min(0.82, l + 0.3) }),
    wisp: hslToHex({ h, s: 0.16, l: 0.92 }),
  };
}

export function paletteFor(hex: string | null, rgb: RGB | null): MarblePalette {
  if (!hex || !rgb) return BRAND_MARBLE;
  return marbleFromColor(rgb);
}
