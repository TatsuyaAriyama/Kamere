import { useEffect, useMemo } from "react";
import { useCollectionStore, DEX_TOTAL } from "../../store/useCollectionStore";
import { useToastStore } from "../../store/useToastStore";
import { TRADITIONAL_COLORS, type NamedColor } from "../../lib/colorName";
import { hexToRgb, isLight, rgbToHsv } from "../../lib/color";

type Props = {
  onClose: () => void;
};

const CATEGORIES = [
  { key: "redpink", label: "赤・桃" },
  { key: "orange", label: "橙・茶" },
  { key: "yellow", label: "黄" },
  { key: "green", label: "緑" },
  { key: "blue", label: "青" },
  { key: "purple", label: "紫" },
  { key: "neutral", label: "白・灰・黒" },
] as const;

type CatKey = (typeof CATEGORIES)[number]["key"];

function categoryOf(hex: string): CatKey {
  const rgb = hexToRgb(hex);
  if (!rgb) return "neutral";
  const { h, s } = rgbToHsv(rgb);
  if (s < 0.12) return "neutral";
  if (h < 20 || h >= 320) return "redpink"; // 桃〜紅
  if (h < 50) return "orange";
  if (h < 70) return "yellow";
  if (h < 160) return "green";
  if (h < 250) return "blue";
  return "purple"; // 250〜320

}

// 伝統色を系統ごとに分類（起動時に1度だけ）。
const GROUPED: { key: CatKey; label: string; colors: NamedColor[] }[] = CATEGORIES.map((cat) => ({
  key: cat.key,
  label: cat.label,
  colors: TRADITIONAL_COLORS.filter((c) => categoryOf(c.hex) === cat.key),
}));

const MILESTONES = [10, 50, 100, DEX_TOTAL];

/** 図鑑。採った色から見つけた伝統色を集めるコレクション画面。 */
export default function DexMode({ onClose }: Props) {
  const discovered = useCollectionStore((s) => s.discovered);
  const reset = useCollectionStore((s) => s.reset);
  const showToast = useToastStore((s) => s.show);

  const count = useMemo(() => Object.keys(discovered).length, [discovered]);
  const pct = Math.round((count / DEX_TOTAL) * 100);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const onReset = () => {
    if (window.confirm("図鑑の発見記録をすべて消します。よろしいですか？")) {
      reset();
      showToast("図鑑をリセットしました");
    }
  };

  return (
    <div className="design-mode" role="dialog" aria-label="図鑑">
      <header className="dm-bar">
        <span className="dm-title">図鑑</span>
        <button type="button" className="dm-close" aria-label="図鑑を閉じる" onClick={onClose}>
          ×
        </button>
      </header>

      <div className="dm-scroll">
        {/* ── 進捗サマリ ── */}
        <div className="dex-summary">
          <div className="dex-progress-num">
            <b>{count}</b>
            <span> / {DEX_TOTAL} 色</span>
          </div>
          <div className="dex-bar" aria-hidden>
            <div className="dex-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="dex-progress-pct">伝統色を {pct}% 発見</span>
        </div>

        {/* ── バッジ ── */}
        <div className="dex-badges">
          {MILESTONES.map((n) => {
            const earned = count >= n;
            const label = n === DEX_TOTAL ? "ｺﾝﾌﾟﾘｰﾄ" : `${n}色`;
            return (
              <span key={n} className={`dex-badge${earned ? " is-earned" : ""}`}>
                {earned ? "★" : "☆"} {label}
              </span>
            );
          })}
          {GROUPED.map((g) => {
            const done = g.colors.every((c) => c.romaji in discovered);
            return (
              <span key={g.key} className={`dex-badge${done ? " is-earned" : ""}`}>
                {done ? "✓" : "・"} {g.label}系
              </span>
            );
          })}
        </div>

        {/* ── 系統別グリッド ── */}
        {GROUPED.map((g) => {
          const found = g.colors.filter((c) => c.romaji in discovered).length;
          return (
            <section key={g.key} className="dex-section">
              <h3 className="dex-section-head">
                {g.label}
                <span className="dex-section-count">
                  {found} / {g.colors.length}
                </span>
              </h3>
              <div className="dex-grid" role="list">
                {g.colors.map((c) => {
                  const rgb = hexToRgb(c.hex)!;
                  const isFound = c.romaji in discovered;
                  if (!isFound) {
                    return (
                      <div key={c.romaji} className="dex-cell is-locked" role="listitem" aria-label="未発見">
                        <span className="dex-chip" aria-hidden>
                          ？
                        </span>
                        <span className="dex-name">？？？</span>
                      </div>
                    );
                  }
                  return (
                    <button
                      key={c.romaji}
                      type="button"
                      className="dex-cell"
                      role="listitem"
                      aria-label={`${c.ja} ${c.hex}`}
                      onClick={() => showToast(`${c.ja}　${c.hex}`)}
                    >
                      <span
                        className="dex-chip"
                        style={{ background: c.hex, color: isLight(rgb) ? "var(--ink)" : "var(--paper)" }}
                        aria-hidden
                      />
                      <span className="dex-name">{c.ja}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}

        <button type="button" className="dex-reset" onClick={onReset}>
          図鑑をリセット
        </button>
      </div>
    </div>
  );
}
