import { useEffect, useMemo, useState } from "react";
import { useCollectionStore, DEX_TOTAL, type DexEntry } from "../../store/useCollectionStore";
import { useToastStore } from "../../store/useToastStore";
import { TRADITIONAL_COLORS, closenessLabel, type NamedColor } from "../../lib/colorName";
import { hexToRgb, isLight } from "../../lib/color";
import { getAllPhotos, clearPhotos } from "../../lib/dexPhotos";

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
  const max = Math.max(rgb.r, rgb.g, rgb.b);
  const min = Math.min(rgb.r, rgb.g, rgb.b);
  const s = max === 0 ? 0 : (max - min) / max;
  if (s < 0.12) return "neutral";
  // 色相を算出
  const rn = rgb.r / 255, gn = rgb.g / 255, bn = rgb.b / 255;
  const mx = Math.max(rn, gn, bn), mn = Math.min(rn, gn, bn), d = mx - mn;
  let h = 0;
  if (d !== 0) {
    if (mx === rn) h = ((gn - bn) / d) % 6;
    else if (mx === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
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

type Detail = { color: NamedColor; entry: DexEntry; photo: string | null };

/** 図鑑＝発見アルバム。採った色から見つけた伝統色を、採取時の証拠写真とともに集める。 */
export default function DexMode({ onClose }: Props) {
  const discovered = useCollectionStore((s) => s.discovered);
  const reset = useCollectionStore((s) => s.reset);
  const showToast = useToastStore((s) => s.show);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [detail, setDetail] = useState<Detail | null>(null);

  const count = useMemo(() => Object.keys(discovered).length, [discovered]);
  const withPhoto = useMemo(
    () => Object.keys(discovered).filter((k) => photos[k]).length,
    [discovered, photos],
  );
  const pct = Math.round((count / DEX_TOTAL) * 100);

  useEffect(() => {
    let alive = true;
    getAllPhotos().then((p) => alive && setPhotos(p));
    return () => {
      alive = false;
    };
  }, [discovered]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (detail) setDetail(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, detail]);

  const onReset = () => {
    if (window.confirm("図鑑の発見記録と写真をすべて消します。よろしいですか？")) {
      reset();
      void clearPhotos();
      setPhotos({});
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
          <div
            className="dex-ring"
            style={{
              background: `conic-gradient(var(--cham) ${pct * 3.6}deg, rgba(237, 231, 217, 0.1) 0)`,
            }}
            aria-hidden
          >
            <div className="dex-ring-inner">
              <b>{count}</b>
              <span>/ {DEX_TOTAL}</span>
            </div>
          </div>
          <div className="dex-summary-meta">
            <span className="dex-summary-pct">{pct}% 発見</span>
            <span className="dex-summary-sub">
              写真 {withPhoto}枚 ・ 残り {DEX_TOTAL - count}色
            </span>
            <span className="dex-rule">カメラで採った色だけが図鑑に記録されます</span>
          </div>
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
                  const entry = discovered[c.romaji];
                  if (!entry) {
                    return (
                      <div key={c.romaji} className="dex-cell is-locked" role="listitem" aria-label="未発見">
                        <span className="dex-chip" aria-hidden />
                        <span className="dex-name" />
                      </div>
                    );
                  }
                  const photo = photos[c.romaji] ?? null;
                  return (
                    <button
                      key={c.romaji}
                      type="button"
                      className="dex-cell"
                      role="listitem"
                      aria-label={`${c.ja} の発見を見る`}
                      onClick={() => setDetail({ color: c, entry, photo })}
                    >
                      <span className="dex-chip" style={{ borderColor: c.hex }} aria-hidden>
                        {photo ? (
                          <>
                            <img className="dex-photo" src={photo} alt="" />
                            <span className="dex-chip-dot" style={{ background: c.hex }} />
                          </>
                        ) : (
                          <span className="dex-flat" style={{ background: c.hex }} />
                        )}
                      </span>
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

      {detail && <DexDetail detail={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function DexDetail({ detail, onClose }: { detail: Detail; onClose: () => void }) {
  const { color, entry, photo } = detail;
  const yourRgb = hexToRgb(entry.hex);
  const tradRgb = hexToRgb(color.hex)!;
  const dateStr = entry.at ? new Date(entry.at).toLocaleDateString("ja-JP") : null;
  const hasDelta = Number.isFinite(entry.deltaE);

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div
        className="color-sheet dex-detail"
        role="dialog"
        aria-label={`${color.ja} の発見`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grip" aria-hidden />

        <div className="dex-detail-photo-wrap">
          {photo ? (
            <img className="dex-detail-photo" src={photo} alt={`${color.ja} を採取した場所`} />
          ) : (
            <div className="dex-detail-photo dex-detail-noimg" style={{ background: color.hex }} aria-hidden>
              <span style={{ color: isLight(tradRgb) ? "var(--ink)" : "var(--paper)" }}>写真なし</span>
            </div>
          )}
        </div>

        <div className="dex-detail-head">
          <span className="dex-detail-ja">{color.ja}</span>
          <span className="dex-detail-romaji">{color.romaji}</span>
        </div>

        <div className="dex-detail-rows">
          <div className="dex-detail-row">
            <span className="dex-detail-sw" style={{ background: color.hex }} aria-hidden />
            <span className="dex-detail-label">伝統色</span>
            <span className="dex-detail-val">{color.hex}</span>
          </div>
          {yourRgb && (
            <div className="dex-detail-row">
              <span className="dex-detail-sw" style={{ background: entry.hex }} aria-hidden />
              <span className="dex-detail-label">採った色</span>
              <span className="dex-detail-val">{entry.hex}</span>
            </div>
          )}
        </div>

        <div className="dex-detail-meta">
          {hasDelta && (
            <span className="dex-detail-chip">
              {closenessLabel(entry.deltaE)}（ΔE {entry.deltaE.toFixed(1)}）
            </span>
          )}
          {dateStr && <span className="dex-detail-chip">発見日 {dateStr}</span>}
        </div>

        <div className="sheet-actions">
          <button type="button" className="sheet-close" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
