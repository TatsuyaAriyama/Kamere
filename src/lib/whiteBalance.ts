import type { RGB } from "./color";

/**
 * ソフトウェア・ホワイトバランス（白基準補正）。
 * 白/グレーの面を基準に各チャンネルのゲインを求め、照明の色かぶりを取り除く。
 * カメラの手動WB制約に頼らないので、iOS Safari でも確実に効く。
 */
export type WBGains = { r: number; g: number; b: number };

const EPS = 1e-4;
const GAIN_MIN = 0.5;
const GAIN_MAX = 2;

const toLinear = (c: number) => {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
};
const toSrgb = (c: number) => {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(v * 255)));
};
const clampGain = (x: number) => Math.max(GAIN_MIN, Math.min(GAIN_MAX, x));

/**
 * 中性であるべき基準色（白/グレー）から補正ゲインを算出。
 * 基準の相対輝度を保ったまま、各チャンネルを中性へ揃える（明るさは変えず色かぶりだけ補正）。
 */
export function computeGains(ref: RGB): WBGains {
  const rl = toLinear(ref.r);
  const gl = toLinear(ref.g);
  const bl = toLinear(ref.b);
  const t = 0.2126 * rl + 0.7152 * gl + 0.0722 * bl; // 基準の相対輝度
  return {
    r: clampGain(t / Math.max(rl, EPS)),
    g: clampGain(t / Math.max(gl, EPS)),
    b: clampGain(t / Math.max(bl, EPS)),
  };
}

/** 補正ゲインを色に適用（リニア光で乗算してから sRGB へ戻す）。gains が null なら素通し。 */
export function applyWhiteBalance(rgb: RGB, gains: WBGains | null): RGB {
  if (!gains) return rgb;
  return {
    r: toSrgb(Math.min(1, toLinear(rgb.r) * gains.r)),
    g: toSrgb(Math.min(1, toLinear(rgb.g) * gains.g)),
    b: toSrgb(Math.min(1, toLinear(rgb.b) * gains.b)),
  };
}
