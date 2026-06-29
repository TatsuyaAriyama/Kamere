import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RGB } from "../lib/color";
import { computeGains, type WBGains } from "../lib/whiteBalance";

type CalibrationState = {
  gains: WBGains | null; // null = 補正なし（既定）
  calibrate: (ref: RGB) => void; // 白/グレー基準から補正をセット
  reset: () => void;
};

/** ホワイトバランス補正の状態。白い面で合わせた時だけ採色に効く（オプトイン・永続）。 */
export const useCalibrationStore = create<CalibrationState>()(
  persist(
    (set) => ({
      gains: null,
      calibrate: (ref) => set({ gains: computeGains(ref) }),
      reset: () => set({ gains: null }),
    }),
    { name: "kamere.wb.v1" },
  ),
);
