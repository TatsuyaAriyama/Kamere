import { create } from "zustand";
import { persist } from "zustand/middleware";

type OnboardingState = {
  seen: boolean; // 初回チュートリアルを見終えたか（永続）
  complete: () => void;
  reopen: () => void; // ヘルプから再表示するとき用
};

/** 初回起動チュートリアルの表示状態。localStorage に永続化して二度目以降は出さない。 */
export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      seen: false,
      complete: () => set({ seen: true }),
      reopen: () => set({ seen: false }),
    }),
    { name: "kamere.onboarding.v1" },
  ),
);
