import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RGB } from "../lib/color";
import { deltaE2000, rgbToHex, rgbToLab } from "../lib/color";

export type Swatch = { id: string; hex: string; rgb: RGB; at: number };

/** add の結果。near が真なら既存色とほぼ同一（重複）で、既存スウォッチを返す。 */
export type AddResult = { swatch: Swatch; near: boolean };

// 既存色とこのΔE2000未満なら「ほぼ同じ色」とみなす（知覚的にほぼ判別不能の閾値）。
const DUP_DELTA_E = 2;

// 採取履歴の保持上限。これを超えた古い色から捨てる。
const HISTORY_MAX = 80;
// お気に入りの保持上限。
const FAV_MAX = 32;

type PaletteState = {
  colors: Swatch[];
  history: Swatch[]; // 採取した色の履歴（clearでも消えない／お絵かきの絵の具に使う）
  favorites: string[]; // お気に入り登録した色（hex）。履歴を消しても残る。
  lastColor: string | null;
  add: (rgb: RGB) => AddResult;
  remove: (id: string) => void;
  clear: () => void;
  clearHistory: () => void;
  toggleFavorite: (hex: string) => void;
};

/** §7: 新規は左→右に追加（末尾append）。lastColor は体色tintに使う。 */
export const usePaletteStore = create<PaletteState>()(
  persist(
    (set, get) => ({
      colors: [],
      history: [],
      favorites: [],
      lastColor: null,
      add: (rgb) => {
        // 既存にほぼ同一の色があれば重複として扱い、追加しない。
        const lab = rgbToLab(rgb);
        const dup = get().colors.find((c) => deltaE2000(lab, rgbToLab(c.rgb)) < DUP_DELTA_E);
        if (dup) {
          set({ lastColor: dup.hex });
          return { swatch: dup, near: true };
        }
        const swatch: Swatch = { id: crypto.randomUUID(), hex: rgbToHex(rgb), rgb, at: Date.now() };
        set((s) => {
          // 履歴は hex 重複を除いて末尾に追加し、上限でトリム（最新を残す）。
          const without = s.history.filter((h) => h.hex.toUpperCase() !== swatch.hex.toUpperCase());
          const history = [...without, swatch].slice(-HISTORY_MAX);
          return { colors: [...s.colors, swatch], history, lastColor: swatch.hex };
        });
        return { swatch, near: false };
      },
      remove: (id) => set((s) => ({ colors: s.colors.filter((c) => c.id !== id) })),
      clear: () => set({ colors: [], lastColor: null }), // 履歴・お気に入りは残す
      clearHistory: () => set({ history: [] }), // お気に入りは残す
      toggleFavorite: (hex) =>
        set((s) => {
          const up = hex.toUpperCase();
          const has = s.favorites.some((h) => h.toUpperCase() === up);
          return {
            favorites: has
              ? s.favorites.filter((h) => h.toUpperCase() !== up)
              : [...s.favorites, hex].slice(-FAV_MAX),
          };
        }),
    }),
    {
      name: "kamere.palette.v1",
      partialize: (s) => ({
        colors: s.colors,
        history: s.history,
        favorites: s.favorites,
        lastColor: s.lastColor,
      }),
    },
  ),
);
