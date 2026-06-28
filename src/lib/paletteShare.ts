import type { Swatch } from "../store/usePaletteStore";
import { nearestColorName, systematicName } from "./colorName";
import { copyText } from "./clipboard";

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
