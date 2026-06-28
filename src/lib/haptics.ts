import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

/** グラブ成立時の触覚。ネイティブはCapacitor、webはVibration APIにfallback。 */
export async function grabHaptic(): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Light });
      return;
    }
  } catch {
    /* プラグイン未利用環境では握りつぶしてfallbackへ */
  }
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(10);
  }
}
