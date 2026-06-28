import { useEffect, useMemo, useState } from "react";
import { usePaletteStore, type Swatch } from "../../store/usePaletteStore";
import { useThemeStore } from "../../store/useThemeStore";
import { useToastStore } from "../../store/useToastStore";
import { copyText } from "../../lib/clipboard";
import { hexToRgb, wcagGrade } from "../../lib/color";
import {
  autoAssignRoles,
  bestOn,
  DEFAULT_ROLES,
  ROLE_META,
  toThemeCss,
  type RoleKey,
} from "../../lib/theme";

type Props = {
  onClose: () => void;
};

export default function DesignMode({ onClose }: Props) {
  const palette = usePaletteStore((s) => s.colors);
  const favorites = usePaletteStore((s) => s.favorites);
  const roles = useThemeStore((s) => s.roles);
  const setRole = useThemeStore((s) => s.setRole);
  const setRoles = useThemeStore((s) => s.setRoles);
  const showToast = useToastStore((s) => s.show);
  const [active, setActive] = useState<RoleKey>("primary");

  // お気に入りを Swatch 化（履歴・パレットを消しても配色に使える）。
  const favSwatches = useMemo<Swatch[]>(() => {
    const out: Swatch[] = [];
    for (const hex of favorites) {
      const rgb = hexToRgb(hex);
      if (rgb) out.push({ id: `fav-${hex}`, hex, rgb, at: 0 });
    }
    return out;
  }, [favorites]);

  // 配色に使える色 = 今のパレット ∪ お気に入り（hexで重複除去）。
  const colors = useMemo<Swatch[]>(() => {
    const map = new Map<string, Swatch>();
    for (const c of palette) map.set(c.hex.toUpperCase(), c);
    for (const f of favSwatches) if (!map.has(f.hex.toUpperCase())) map.set(f.hex.toUpperCase(), f);
    return [...map.values()];
  }, [palette, favSwatches]);

  // 初回（未初期化）はパレットから自動割り当て。
  useEffect(() => {
    if (!roles) setRoles(autoAssignRoles(colors));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escで閉じる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const r = roles ?? DEFAULT_ROLES;
  const onPrimary = bestOn(r.primary);
  const onAccent = bestOn(r.accent);

  const autoAssign = () => {
    setRoles(autoAssignRoles(colors));
    showToast(colors.length ? "色を自動で割り当て" : "まず色を採りましょう");
  };

  const assignFromFavorites = () => {
    setRoles(autoAssignRoles(favSwatches));
    showToast("お気に入りから配色しました");
  };

  const copyTheme = async () => {
    const ok = await copyText(toThemeCss(r));
    showToast(ok ? "テーマCSSをコピー" : "コピーに失敗しました");
  };

  const activeMeta = ROLE_META.find((m) => m.key === active)!;

  return (
    <div className="design-mode" role="dialog" aria-label="デザインモード">
      <header className="dm-bar">
        <span className="dm-title">デザイン</span>
        <button type="button" className="dm-close" aria-label="デザインを閉じる" onClick={onClose}>
          ×
        </button>
      </header>

      <div className="dm-scroll">
        {/* ── ライブプレビュー ── */}
        <div className="dp-screen" style={{ background: r.bg, color: r.text }}>
          <div className="dp-nav" style={{ background: r.surface, color: r.text }}>
            <span className="dp-nav-brand">カメレ</span>
            <span className="dp-nav-dot" style={{ background: r.accent }} aria-hidden />
          </div>

          <div className="dp-hero" style={{ background: r.primary, color: onPrimary }}>
            <span className="dp-hero-title">採った色でデザイン</span>
            <span className="dp-hero-sub">テーマをそのまま確認</span>
          </div>

          <div className="dp-card" style={{ background: r.surface, color: r.text }}>
            <span className="dp-card-title">見出しテキスト</span>
            <span className="dp-card-body">
              本文はこの文字色で表示されます。背景と面の上で読みやすいか確かめましょう。
            </span>
            <div className="dp-actions">
              <button
                type="button"
                className="dp-btn"
                style={{ background: r.primary, color: onPrimary }}
              >
                主要ボタン
              </button>
              <button
                type="button"
                className="dp-btn ghost"
                style={{ color: r.accent, borderColor: r.accent }}
              >
                サブ
              </button>
              <span className="dp-badge" style={{ background: r.accent, color: onAccent }}>
                バッジ
              </span>
            </div>
          </div>
        </div>

        {/* ── コントラスト診断 ── */}
        <div className="dm-checks">
          <ContrastChip label="文字 / 背景" fg={r.text} bg={r.bg} />
          <ContrastChip label="文字 / 面" fg={r.text} bg={r.surface} />
          <ContrastChip label="ボタン文字 / 主役" fg={onPrimary} bg={r.primary} />
        </div>

        {/* ── 役割エディタ ── */}
        <div className="dm-roles" role="tablist" aria-label="役割">
          {ROLE_META.map((m) => (
            <button
              key={m.key}
              type="button"
              role="tab"
              aria-selected={active === m.key}
              className={`dm-role${active === m.key ? " is-active" : ""}`}
              onClick={() => setActive(m.key)}
            >
              <span className="dm-role-chip" style={{ background: r[m.key] }} aria-hidden />
              <span className="dm-role-label">{m.label}</span>
            </button>
          ))}
        </div>

        <div className="dm-assign">
          <span className="dm-assign-head">
            <b>{activeMeta.label}</b> に割り当て <span className="dm-assign-hint">{activeMeta.hint}</span>
          </span>
          {colors.length === 0 ? (
            <p className="dm-empty">まだ色がありません。カメラや写真から色を採るとここで使えます。</p>
          ) : (
            <div className="dm-swatches" role="list">
              {colors.map((c) => {
                const sel = r[active]?.toUpperCase() === c.hex.toUpperCase();
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="listitem"
                    className={`dm-swatch${sel ? " is-sel" : ""}`}
                    style={{ background: c.hex }}
                    aria-label={`${c.hex} を ${activeMeta.label} に`}
                    aria-pressed={sel}
                    onClick={() => setRole(active, c.hex)}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* ── アクション ── */}
        <div className="dm-actions">
          <button type="button" className="dm-action" onClick={autoAssign}>
            自動で割り当て
          </button>
          {favSwatches.length > 0 && (
            <button type="button" className="dm-action" onClick={assignFromFavorites}>
              ★お気に入りから配色
            </button>
          )}
          <button type="button" className="dm-action primary" onClick={copyTheme}>
            テーマCSSをコピー
          </button>
        </div>
      </div>
    </div>
  );
}

function ContrastChip({ label, fg, bg }: { label: string; fg: string; bg: string }) {
  const fr = hexToRgb(fg);
  const br = hexToRgb(bg);
  const grade = fr && br ? wcagGrade(fr, br) : null;
  const pass = grade?.aaNormal ?? false;
  return (
    <div className="dm-check">
      <span className="dm-check-sample" style={{ background: bg, color: fg }} aria-hidden>
        Aあ
      </span>
      <span className="dm-check-label">{label}</span>
      <span className="dm-check-ratio">{grade ? `${grade.ratio.toFixed(1)}:1` : "—"}</span>
      <span className={`dm-check-flag ${pass ? "ok" : "ng"}`}>{pass ? "AA" : "弱"}</span>
    </div>
  );
}
