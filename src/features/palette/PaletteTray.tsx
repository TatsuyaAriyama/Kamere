import { useState } from "react";
import { usePaletteStore, type Swatch } from "../../store/usePaletteStore";
import { isLight } from "../../lib/color";
import ColorDetail from "./ColorDetail";
import ExportSheet from "./ExportSheet";

export default function PaletteTray() {
  const colors = usePaletteStore((s) => s.colors);
  const remove = usePaletteStore((s) => s.remove);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const selected: Swatch | null = colors.find((c) => c.id === selectedId) ?? null;

  return (
    <footer className="tray" aria-label="採った色">
      <span className="tray-label">採った色</span>
      <div className="swatches" role="list">
        {colors.length === 0 && <span className="tray-empty">まだありません</span>}
        {colors.map((c) => (
          <div className="swatch" role="listitem" key={c.id}>
            <button
              type="button"
              className="swatch-chip"
              style={{ background: c.hex }}
              aria-label={`${c.hex} の詳細を見る`}
              onClick={() => setSelectedId(c.id)}
            >
              <span
                className="swatch-hex"
                style={{ color: isLight(c.rgb) ? "var(--ink)" : "var(--paper)" }}
              >
                {c.hex.replace("#", "")}
              </span>
            </button>
            <button
              type="button"
              className="swatch-del"
              aria-label={`${c.hex} を削除`}
              onClick={() => remove(c.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="copy-all"
        disabled={!colors.length}
        onClick={() => setExporting(true)}
      >
        書き出す
      </button>

      {selected && (
        <ColorDetail swatch={selected} onClose={() => setSelectedId(null)} onRemove={remove} />
      )}
      {exporting && <ExportSheet colors={colors} onClose={() => setExporting(false)} />}
    </footer>
  );
}
