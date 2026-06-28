export type RGB = { r: number; g: number; b: number };

const hh = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");

export function rgbToHex({ r, g, b }: RGB): string {
  return `#${hh(r)}${hh(g)}${hh(b)}`.toUpperCase();
}

export function hexToRgb(hex: string): RGB | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** 知覚輝度（0..1）。スウォッチ上の文字色をpaper/inkで選ぶのに使う。 */
export function luminance({ r, g, b }: RGB): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function isLight(rgb: RGB): boolean {
  return luminance(rgb) > 0.62;
}

/** 近接色判定用の二乗ユークリッド距離（sqrt省略）。 */
export function colorDistanceSq(a: RGB, b: RGB): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

export type HSL = { h: number; s: number; l: number }; // h:0..360, s/l:0..1

export function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
    }
    h *= 60;
  }
  return { h, s, l };
}

/** CSS rgb() 文字列。デザインツール/コードへ貼る用。 */
export function rgbCss({ r, g, b }: RGB): string {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

/** CSS hsl() 文字列。色相基準で調整する用。 */
export function hslCss({ h, s, l }: HSL): string {
  const hh = Math.round(((h % 360) + 360) % 360);
  return `hsl(${hh}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}

/** 採色した色を基準にした濃淡ランプ（明→暗）。1色からパレットを組む用。 */
export function shadesOf(rgb: RGB): string[] {
  const { h, s } = rgbToHsl(rgb);
  const sat = Math.max(0.2, Math.min(0.9, s));
  const ls = [0.9, 0.74, 0.58, 0.42, 0.28, 0.16];
  return ls.map((l) => hslToHex({ h, s: l > 0.82 ? sat * 0.55 : sat, l }));
}

/** WCAG相対輝度（0..1）。アクセシビリティのコントラスト計算に使う。 */
export function relLuminance({ r, g, b }: RGB): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

/** WCAG コントラスト比（1..21）。明暗どちらの順でも同じ値。 */
export function contrastRatio(a: RGB, b: RGB): number {
  const la = relLuminance(a);
  const lb = relLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

export type WcagGrade = {
  ratio: number;
  aaNormal: boolean; // 本文 4.5:1
  aaaNormal: boolean; // 本文(強化) 7:1
  aaLarge: boolean; // 大きな文字 3:1
};

/** コントラスト比から WCAG 各基準の合否を判定。 */
export function wcagGrade(a: RGB, b: RGB): WcagGrade {
  const ratio = contrastRatio(a, b);
  return {
    ratio,
    aaNormal: ratio >= 4.5,
    aaaNormal: ratio >= 7,
    aaLarge: ratio >= 3,
  };
}

export type OKLCH = { L: number; C: number; h: number }; // L:0..1, C:~0..0.4, h:0..360

/** sRGB → OKLCH。知覚的に均一で、CSS oklch() にそのまま使える現代的な色表現。 */
export function rgbToOklch({ r, g, b }: RGB): OKLCH {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const C = Math.hypot(a, bb);
  let h = (Math.atan2(bb, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { L, C, h };
}

/** CSS oklch() 文字列。 */
export function oklchCss({ L, C, h }: OKLCH): string {
  return `oklch(${(L * 100).toFixed(1)}% ${C.toFixed(3)} ${h.toFixed(1)})`;
}

const linearToSrgb = (c: number) => {
  const v = Math.max(0, Math.min(1, c));
  const s = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(s * 255)));
};

/** OKLCH → sRGB。色域外は各チャンネルをクランプ（実用上の単純ガマットマップ）。 */
export function oklchToRgb({ L, C, h }: OKLCH): RGB {
  const a = C * Math.cos((h * Math.PI) / 180);
  const bb = C * Math.sin((h * Math.PI) / 180);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * bb;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * bb;
  const s_ = L - 0.0894841775 * a - 1.291485548 * bb;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const b = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  return { r: linearToSrgb(r), g: linearToSrgb(g), b: linearToSrgb(b) };
}

export type ScaleStep = { step: number; hex: string };

// 各ステップの目標明度(OKLCH L)と彩度係数。明端/暗端は彩度を抑えて自然な階調に。
const SCALE_STOPS: { step: number; L: number; cf: number }[] = [
  { step: 50, L: 0.972, cf: 0.3 },
  { step: 100, L: 0.93, cf: 0.45 },
  { step: 200, L: 0.86, cf: 0.65 },
  { step: 300, L: 0.78, cf: 0.85 },
  { step: 400, L: 0.7, cf: 0.95 },
  { step: 500, L: 0.62, cf: 1.0 },
  { step: 600, L: 0.54, cf: 1.0 },
  { step: 700, L: 0.45, cf: 0.95 },
  { step: 800, L: 0.37, cf: 0.85 },
  { step: 900, L: 0.29, cf: 0.72 },
];

/** ベース色から知覚均等な 50→900 のトーンスケールを生成（色相は固定）。 */
export function colorScale(rgb: RGB): ScaleStep[] {
  const { C, h } = rgbToOklch(rgb);
  return SCALE_STOPS.map(({ step, L, cf }) => ({
    step,
    hex: rgbToHex(oklchToRgb({ L, C: C * cf, h })),
  }));
}

/** sRGB → CSS color(display-p3 …)。広色域ディスプレイ向け。同一色をP3座標で表現。 */
export function displayP3Css({ r, g, b }: RGB): string {
  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(b);
  // linear sRGB → XYZ (D65)
  const X = R * 0.4124564 + G * 0.3575761 + B * 0.1804375;
  const Y = R * 0.2126729 + G * 0.7151522 + B * 0.072175;
  const Z = R * 0.0193339 + G * 0.119192 + B * 0.9503041;
  // XYZ (D65) → linear Display-P3
  const pr = 2.4934969 * X - 0.9313836 * Y - 0.4027108 * Z;
  const pg = -0.829489 * X + 1.7626641 * Y + 0.0236247 * Z;
  const pb = 0.0358458 * X - 0.0761724 * Y + 0.9568845 * Z;
  const enc = (c: number) => {
    const v = Math.max(0, Math.min(1, c));
    return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  };
  const f = (c: number) => enc(c).toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  return `color(display-p3 ${f(pr)} ${f(pg)} ${f(pb)})`;
}

export type HSV = { h: number; s: number; v: number }; // h:0..360, s/v:0..1

/** トーン判定用。HSVの彩度/明度は淡色の扱いがHSLより素直。 */
export function rgbToHsv({ r, g, b }: RGB): HSV {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    switch (max) {
      case rn:
        h = ((gn - bn) / d) % 6;
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export type Lab = { L: number; a: number; b: number };

const srgbToLinear = (c: number) => {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
};

/** sRGB → CIELAB (D65)。知覚的な色差計算の基盤。 */
export function rgbToLab({ r, g, b }: RGB): Lab {
  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(b);
  const X = R * 0.4124564 + G * 0.3575761 + B * 0.1804375;
  const Y = R * 0.2126729 + G * 0.7151522 + B * 0.072175;
  const Z = R * 0.0193339 + G * 0.119192 + B * 0.9503041;
  const xn = 0.95047;
  const yn = 1;
  const zn = 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X / xn);
  const fy = f(Y / yn);
  const fz = f(Z / zn);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/** CIEDE2000 色差。人の見た目に最も近い距離尺度（ΔE2000）。 */
export function deltaE2000(l1: Lab, l2: Lab): number {
  const { L: L1, a: a1, b: b1 } = l1;
  const { L: L2, a: a2, b: b2 } = l2;
  const rad = Math.PI / 180;
  const avgLp = (L1 + L2) / 2;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const avgC = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Math.pow(avgC, 7) / (Math.pow(avgC, 7) + Math.pow(25, 7))));
  const a1p = a1 * (1 + G);
  const a2p = a2 * (1 + G);
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const avgCp = (C1p + C2p) / 2;
  const hp = (ap: number, bp: number) => {
    if (ap === 0 && bp === 0) return 0;
    const h = Math.atan2(bp, ap) * (180 / Math.PI);
    return h >= 0 ? h : h + 360;
  };
  const h1p = hp(a1p, b1);
  const h2p = hp(a2p, b2);
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = h2p - h1p;
  if (Math.abs(dhp) > 180) dhp -= Math.sign(dhp) * 360;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * rad) / 2);
  let avghp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) avghp = (h1p + h2p + 360) / 2;
    else avghp = (h1p + h2p) / 2;
  }
  const T =
    1 -
    0.17 * Math.cos((avghp - 30) * rad) +
    0.24 * Math.cos(2 * avghp * rad) +
    0.32 * Math.cos((3 * avghp + 6) * rad) -
    0.2 * Math.cos((4 * avghp - 63) * rad);
  const dTheta = 30 * Math.exp(-Math.pow((avghp - 275) / 25, 2));
  const Rc = 2 * Math.sqrt(Math.pow(avgCp, 7) / (Math.pow(avgCp, 7) + Math.pow(25, 7)));
  const Sl = 1 + (0.015 * Math.pow(avgLp - 50, 2)) / Math.sqrt(20 + Math.pow(avgLp - 50, 2));
  const Sc = 1 + 0.045 * avgCp;
  const Sh = 1 + 0.015 * avgCp * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt(
    Math.pow(dLp / Sl, 2) +
      Math.pow(dCp / Sc, 2) +
      Math.pow(dHp / Sh, 2) +
      Rt * (dCp / Sc) * (dHp / Sh),
  );
}

export function hslToHex({ h, s, l }: HSL): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  return rgbToHex({ r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 });
}
