import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RGB } from "../lib/color";

export type InspoSwatch = { hex: string; rgb: RGB };

/** インスピ・キャプチャ1枚＝写真（IndexedDBに別保存）＋抽出した配色＋メモ。 */
export type InspoCard = {
  id: string;
  at: number;
  palette: InspoSwatch[];
  note?: string;
};

type InspoState = {
  cards: InspoCard[]; // 新しい順
  add: (card: InspoCard) => void;
  remove: (id: string) => void;
  setNote: (id: string, note: string) => void;
  clear: () => void;
};

/** 散歩中に撮った「インスピカード」のコレクション。写真本体は inspoPhotos(IndexedDB)に保存。 */
export const useInspoStore = create<InspoState>()(
  persist(
    (set) => ({
      cards: [],
      add: (card) => set((s) => ({ cards: [card, ...s.cards] })),
      remove: (id) => set((s) => ({ cards: s.cards.filter((c) => c.id !== id) })),
      setNote: (id, note) =>
        set((s) => ({ cards: s.cards.map((c) => (c.id === id ? { ...c, note } : c)) })),
      clear: () => set({ cards: [] }),
    }),
    { name: "kamere.inspo.v1" },
  ),
);
