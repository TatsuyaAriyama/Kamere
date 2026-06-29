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
 * 捕まえた色をそのまま主役にしたティントマーブル。
 * mid は採取色そのもの。他バンドは明度だけを振って渦の陰影を作る。
 * 彩度は一切足さない（黒/白/灰を忠実に — 無彩色が別の色に化けないように）。
 */
export function marbleFromColor(rgb: RGB): MarblePalette {
  const { h, s, l } = rgbToHsl(rgb);
  const sat = Math.min(1, s);
  const cl = (x: number) => Math.max(0, Math.min(1, x));
  return {
    mid: hslToHex({ h, s: sat, l: cl(l) }), // ＝採取色そのもの
    deep: hslToHex({ h, s: sat, l: cl(l - 0.16) }),
    accent: hslToHex({ h: sat > 0.12 ? h + 12 : h, s: sat, l: cl(l - 0.05) }),
    light: hslToHex({ h, s: sat * 0.85, l: cl(l + 0.2) }),
    wisp: hslToHex({ h, s: sat * 0.4, l: cl(l + 0.34) }),
  };
}

export function paletteFor(hex: string | null, rgb: RGB | null): MarblePalette {
  if (!hex || !rgb) return BRAND_MARBLE;
  return marbleFromColor(rgb);
}
