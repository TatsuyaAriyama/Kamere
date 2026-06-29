import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RGB } from "../lib/color";
import { nearestColorName, TRADITIONAL_COLORS, type NamedColor } from "../lib/colorName";

// 図鑑の収集対象＝伝統色の総数。
export const DEX_TOTAL = TRADITIONAL_COLORS.length;

export type DiscoverResult = { color: NamedColor; deltaE: number; isNew: boolean };

type CollectionState = {
  // 発見済み伝統色。キー=romaji、値=初発見時刻(ms)。
  discovered: Record<string, number>;
  /** 採色した色に最も近い伝統色を「発見」として記録。初発見なら isNew=true。 */
  discover: (rgb: RGB) => DiscoverResult;
  reset: () => void;
};

/** 採った色から最寄りの伝統色を図鑑に集めていく。履歴やパレットを消しても残る永続コレクション。 */
export const useCollectionStore = create<CollectionState>()(
  persist(
    (set, get) => ({
      discovered: {},
      discover: (rgb) => {
        const { color, deltaE } = nearestColorName(rgb);
        const key = color.romaji;
        const already = key in get().discovered;
        if (!already) {
          set((s) => ({ discovered: { ...s.discovered, [key]: Date.now() } }));
        }
        return { color, deltaE, isNew: !already };
      },
      reset: () => set({ discovered: {} }),
    }),
    { name: "kamere.dex.v1" },
  ),
);
