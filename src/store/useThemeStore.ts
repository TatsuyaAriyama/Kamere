import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RoleKey, ThemeRoles } from "../lib/theme";

type ThemeState = {
  /** null は未初期化（デザインモード初回起動でパレットから自動割り当て）。 */
  roles: ThemeRoles | null;
  setRole: (key: RoleKey, hex: string) => void;
  setRoles: (roles: ThemeRoles) => void;
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      roles: null,
      setRole: (key, hex) =>
        set((s) => (s.roles ? { roles: { ...s.roles, [key]: hex } } : s)),
      setRoles: (roles) => set({ roles }),
    }),
    { name: "kamere.theme.v1" },
  ),
);
