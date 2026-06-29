import { useCallback, useEffect, useState } from "react";
import Stage from "./features/picker/Stage";
import PaletteTray from "./features/palette/PaletteTray";
import DesignMode from "./features/design/DesignMode";
import DrawMode from "./features/draw/DrawMode";
import DexMode from "./features/dex/DexMode";
import Onboarding from "./features/onboarding/Onboarding";
import Toast from "./features/ui/Toast";
import { usePaletteStore } from "./store/usePaletteStore";
import { useChameleonStore } from "./store/useChameleonStore";
import { useOnboardingStore } from "./store/useOnboardingStore";
import { useToastStore } from "./store/useToastStore";
import { hexToRgb } from "./lib/color";
import { parseSharedHexes } from "./lib/paletteShare";
import type { SourceErrorKind } from "./features/picker/source";
import "./App.css";

type Source = "camera" | "photo";

export default function App() {
  const [source, setSource] = useState<Source>("camera");
  const [cameraMsg, setCameraMsg] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(true);
  const [designOpen, setDesignOpen] = useState(false);
  const [drawOpen, setDrawOpen] = useState(false);
  const [dexOpen, setDexOpen] = useState(false);

  const clearPalette = usePaletteStore((s) => s.clear);
  const resetBody = useChameleonStore((s) => s.setBodyColor);
  const colorCount = usePaletteStore((s) => s.colors.length);
  const seenOnboarding = useOnboardingStore((s) => s.seen);
  const completeOnboarding = useOnboardingStore((s) => s.complete);
  const reopenOnboarding = useOnboardingStore((s) => s.reopen);

  // チュートリアルを閉じてから初回ヒントを出し、数秒で消す
  useEffect(() => {
    if (!seenOnboarding) return;
    setShowHint(true);
    const id = window.setTimeout(() => setShowHint(false), 4200);
    return () => window.clearTimeout(id);
  }, [seenOnboarding]);

  // 共有リンク（#p=…）で開かれたら、その配色を読み込む
  useEffect(() => {
    const hexes = parseSharedHexes();
    if (!hexes?.length) return;
    let added = 0;
    let lastHex: string | null = null;
    for (const hex of hexes) {
      const rgb = hexToRgb(hex);
      if (!rgb) continue;
      const { near } = usePaletteStore.getState().add(rgb);
      // 図鑑はカメラ採取のみ反映。共有リンクからの取り込みは記録しない。
      if (!near) added += 1;
      lastHex = hex;
    }
    if (lastHex) useChameleonStore.getState().setBodyColor(lastHex);
    // 二重読み込みを防ぐためハッシュを除去
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    if (added > 0) useToastStore.getState().show(`共有された配色 ${added}色を読み込みました`);
  }, []);

  // 永続化されたパレットがあれば、起動時に体色を最後の色へ復元
  useEffect(() => {
    const last = usePaletteStore.getState().lastColor;
    if (last) useChameleonStore.getState().setBodyColor(last);
  }, []);

  const onCameraError = useCallback((kind: SourceErrorKind) => {
    setSource("photo");
    setCameraMsg(
      kind === "permission"
        ? "カメラを使えませんでした。写真からでも色を採れます。下のエリアから画像を選んでください。"
        : "カメラが見つかりませんでした。写真モードに切り替えました。",
    );
  }, []);

  const pickSource = (s: Source) => {
    if (s === "camera") setCameraMsg(null);
    setSource(s);
  };

  const clearAll = () => {
    clearPalette();
    resetBody(""); // 体色をブランドに戻す（空→null扱い）
  };

  return (
    <div className="app">
      <header className="topbar">
        <button
          type="button"
          className="brand"
          aria-label="つかいかたを見る"
          onClick={reopenOnboarding}
        >
          カメレ
        </button>
        <div className="topbar-actions">
          <div className="source-toggle" role="group" aria-label="カラーソース">
            <button
              type="button"
              className={`seg${source === "camera" ? " is-active" : ""}`}
              aria-pressed={source === "camera"}
              onClick={() => pickSource("camera")}
            >
              カメラ
            </button>
            <button
              type="button"
              className={`seg${source === "photo" ? " is-active" : ""}`}
              aria-pressed={source === "photo"}
              onClick={() => pickSource("photo")}
            >
              写真
            </button>
          </div>
          <button
            type="button"
            className="design-enter"
            aria-label="配色モードを開く"
            onClick={() => setDesignOpen(true)}
          >
            配色
          </button>
          <button
            type="button"
            className="design-enter"
            aria-label="お絵かきモードを開く"
            onClick={() => setDrawOpen(true)}
          >
            お絵かき
          </button>
          <button
            type="button"
            className="design-enter"
            aria-label="図鑑を開く"
            onClick={() => setDexOpen(true)}
          >
            図鑑
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="採った色をすべて消去"
            disabled={colorCount === 0}
            onClick={clearAll}
          >
            ⌫
          </button>
        </div>
      </header>

      <div className="stage-wrap">
        <Stage source={source} onCameraError={onCameraError} />
        {cameraMsg && source === "photo" && <div className="banner">{cameraMsg}</div>}
        {showHint && seenOnboarding && (
          <div className="hint" role="status">
            カメレオンを掴んで動かす。離した所の色を採る。長押しでルーペ照準。
          </div>
        )}
      </div>

      <PaletteTray />
      <Toast />

      {designOpen && <DesignMode onClose={() => setDesignOpen(false)} />}
      {drawOpen && <DrawMode onClose={() => setDrawOpen(false)} />}
      {dexOpen && <DexMode onClose={() => setDexOpen(false)} />}

      {!seenOnboarding && <Onboarding onClose={completeOnboarding} />}
    </div>
  );
}
