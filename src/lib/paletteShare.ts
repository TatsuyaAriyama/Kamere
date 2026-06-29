import type { Swatch } from "../store/usePaletteStore";
import { nearestColorName, systematicName } from "./colorName";
import { copyText } from "./clipboard";

// 共有URLに載せる最大色数（URLが長くなりすぎないよう上限）。
const SHARE_MAX = 64;

/** パレットを URL パラメータ用の文字列へ。各色を # 抜き6桁HEXで連結（1色=6文字）。 */
export function encodePalette(colors: Swatch[]): string {
  return colors
    .slice(0, SHARE_MAX)
    .map((c) => c.hex.replace("#", "").toUpperCase())
    .join("");
}

/** encodePalette の逆。6文字ごとに区切り、妥当な #HEX 配列に復元。 */
export function decodePalette(param: string): string[] {
  const clean = param.replace(/[^0-9a-fA-F]/g, "");
  const out: string[] = [];
  for (let i = 0; i + 6 <= clean.length && out.length < SHARE_MAX; i += 6) {
    out.push(`#${clean.slice(i, i + 6).toUpperCase()}`);
  }
  return out;
}

/** 現在の配信元（BASE_URL 込み）に #p=… を付けた共有URLを組み立てる。 */
export function buildShareUrl(colors: Swatch[]): string {
  const base = `${window.location.origin}${import.meta.env.BASE_URL}`;
  return `${base}#p=${encodePalette(colors)}`;
}

/** location.hash に共有パレット（#p=…）があれば #HEX 配列で返す。無ければ null。 */
export function parseSharedHexes(): string[] | null {
  const m = /[#&]p=([0-9a-fA-F]+)/.exec(window.location.hash);
  if (!m) return null;
  const hexes = decodePalette(m[1]);
  return hexes.length ? hexes : null;
}

/** パレットを「HEX  系統色名（近い伝統色）」の読みやすいテキストへ整形。 */
export function formatPalette(colors: Swatch[]): string {
  const lines = colors.map((c) => {
    const sys = systematicName(c.rgb);
    const trad = nearestColorName(c.rgb).color.ja;
    return `${c.hex}  ${sys}（${trad}）`;
  });
  return [`カメレで採った色 ${colors.length}色`, ...lines].join("\n");
}

export type ShareResult = "shared" | "copied" | "cancelled" | "failed";

/** ネイティブ共有シート（Web Share API）。未対応時はクリップボードへフォールバック。 */
export async function sharePalette(colors: Swatch[]): Promise<ShareResult> {
  if (!colors.length) return "failed";
  const text = formatPalette(colors);
  if (navigator.share) {
    try {
      await navigator.share({ title: "カメレのパレット", text });
      return "shared";
    } catch (err) {
      // ユーザーが共有シートを閉じただけ。エラー扱いせず静かに終える。
      if ((err as DOMException)?.name === "AbortError") return "cancelled";
      // それ以外（共有不可など）はコピーへフォールバック。
    }
  }
  return (await copyText(text)) ? "copied" : "failed";
}
