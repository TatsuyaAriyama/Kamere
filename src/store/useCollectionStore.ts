import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RGB } from "../lib/color";
import { rgbToHex } from "../lib/color";
import { nearestColorName, TRADITIONAL_COLORS, type NamedColor } from "../lib/colorName";

// 図鑑の収集対象＝伝統色の総数。
export const DEX_TOTAL = TRADITIONAL_COLORS.length;

// 発見1件のメタデータ（写真本体は IndexedDB に別保存。ここは軽量に保つ）。
export type DexEntry = {
  at: number; // 初発見時刻(ms)
  hex: string; // 発見時に自分が採った色
  deltaE: number; // 最寄り伝統色との色差（小さいほど正確）
};

export type DiscoverResult = { color: NamedColor; deltaE: number; isNew: boolean };

type CollectionState = {
  discovered: Record<string, DexEntry>; // キー=romaji
  /** 採色した色に最も近い伝統色を「発見」として記録。初発見なら isNew=true。 */
  discover: (rgb: RGB) => DiscoverResult;
  reset: () => void;
};

/** 採った色から最寄りの伝統色を図鑑に集めていく永続コレクション。 */
export const useCollectionStore = create<CollectionState>()(
  persist(
    (set, get) => ({
      discovered: {},
      discover: (rgb) => {
        const { color, deltaE } = nearestColorName(rgb);
        const key = color.romaji;
        const already = key in get().discovered;
        if (!already) {
          const entry: DexEntry = { at: Date.now(), hex: rgbToHex(rgb), deltaE };
          set((s) => ({ discovered: { ...s.discovered, [key]: entry } }));
        }
        return { color, deltaE, isNew: !already };
      },
      reset: () => set({ discovered: {} }),
    }),
    {
      name: "kamere.dex.v1",
      version: 2,
      // v1（discovered: Record<romaji, number>）→ v2（Record<romaji, DexEntry>）。
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as { discovered?: Record<string, unknown> };
        if (version < 2 && state.discovered) {
          const next: Record<string, DexEntry> = {};
          for (const [key, val] of Object.entries(state.discovered)) {
            next[key] =
              typeof val === "number"
                ? { at: val, hex: "", deltaE: Number.NaN }
                : (val as DexEntry);
          }
          state.discovered = next;
        }
        return state as unknown as CollectionState;
      },
    },
  ),
);
