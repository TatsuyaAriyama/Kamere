import { create } from "zustand";

export type ChameleonPhase = "idle" | "dragging" | "grabbing";
export type Vec = { x: number; y: number };

type ChameleonState = {
  pos: Vec;             // stage-local CSS px, カメレオンの口元(基準点)
  facing: 1 | -1;      // 1 = 右向き, -1 = 左向き
  phase: ChameleonPhase;
  bodyColor: string | null; // 採色後のhex。null = ブランド配色(idle)
  aim: Vec | null;     // 照準点(stage-local)。狙っている間だけ目/姿勢が向く
  setPos: (p: Vec) => void;
  setFacing: (f: 1 | -1) => void;
  setPhase: (p: ChameleonPhase) => void;
  setBodyColor: (c: string) => void;
  setAim: (a: Vec | null) => void;
};

export const useChameleonStore = create<ChameleonState>((set) => ({
  pos: { x: 0, y: 0 },
  facing: 1,
  phase: "idle",
  bodyColor: null,
  aim: null,
  setPos: (pos) => set({ pos }),
  setFacing: (facing) => set({ facing }),
  setPhase: (phase) => set({ phase }),
  setBodyColor: (bodyColor) => set({ bodyColor }),
  setAim: (aim) => set({ aim }),
}));
