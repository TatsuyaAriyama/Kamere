import { useEffect, useMemo } from "react";
import type { Swatch } from "../../store/usePaletteStore";
import { useToastStore } from "../../store/useToastStore";
import { copyText } from "../../lib/clipboard";
import {
  colorScale,
  displayP3Css,
  hslCss,
  isLight,
  oklchCss,
  rgbCss,
  rgbToHsl,
  rgbToOklch,
  wcagGrade,
  type WcagGrade,
} from "../../lib/color";
import { closenessLabel, nearestColorName, systematicName } from "../../lib/colorName";

type Props = {
  swatch: Swatch;
  onClose: () => void;
  onRemove: (id: string) => void;
};

export default function ColorDetail({ swatch, onClose, onRemove }: Props) {
  const showToast = useToastStore((s) => s.show);

  const { hsl, oklch, p3, systematic, match, scale, onWhite, onBlack } = useMemo(() => {
    return {
      hsl: rgbToHsl(swatch.rgb),
      oklch: rgbToOklch(swatch.rgb),
      p3: displayP3Css(swatch.rgb),
      systematic: systematicName(swatch.rgb),
      match: nearestColorName(swatch.rgb),
      scale: colorScale(swatch.rgb),
      onWhite: wcagGrade(swatch.rgb, { r: 255, g: 255, b: 255 }),
      onBlack: wcagGrade(swatch.rgb, { r: 0, g: 0, b: 0 }),
    };
  }, [swatch]);

  // CSS変数名のスラッグ（近い伝統色のローマ字をASCII化）。
  const slug = (match.color.romaji || "color").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const scaleCss = scale.map((s) => `--${slug}-${s.step}: ${s.hex};`).join("\n");

  // Escで閉じる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const copy = async (value: string, label: string) => {
    const ok = await copyText(value);
    showToast(ok ? `${label} をコピー` : "コピーに失敗しました");
  };

  const onText = isLight(swatch.rgb) ? "var(--ink)" : "var(--paper)";
  const rows: { key: string; val: string }[] = [
    { key: "HEX", val: swatch.hex },
    { key: "RGB", val: rgbCss(swatch.rgb) },
    { key: "HSL", val: hslCss(hsl) },
    { key: "OKLCH", val: oklchCss(oklch) },
    { key: "P3", val: p3 },
  ];

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div
        className="color-sheet"
        role="dialog"
        aria-label={`${systematic} の詳細`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grip" aria-hidden />

        <div className="sheet-preview" style={{ background: swatch.hex }}>
          <span className="sheet-hex" style={{ color: onText }}>
            {swatch.hex}
          </span>
        </div>

        <div className="sheet-names">
          <span className="name-system">{systematic}</span>
          <div className="name-trad">
            <span className="name-trad-lead">近い色</span>
            <span className="name-trad-ja">{match.color.ja}</span>
            <span className="name-trad-ro">{match.color.romaji}</span>
            <span className="name-close">
              {closenessLabel(match.deltaE)}・ΔE {match.deltaE.toFixed(1)}
            </span>
          </div>
        </div>

        <div className="sheet-codes">
          {rows.map((r) => (
            <button
              key={r.key}
              type="button"
              className="code-row"
              onClick={() => copy(r.val, r.val)}
              aria-label={`${r.key} ${r.val} をコピー`}
            >
              <span className="code-key">{r.key}</span>
              <span className="code-val">{r.val}</span>
              <span className="code-copy" aria-hidden>
                ⧉
              </span>
            </button>
          ))}
        </div>

        <div className="sheet-contrast">
          <span className="contrast-label">文字色コントラスト（WCAG）</span>
          <ContrastRow bg={swatch.hex} fg="#FFFFFF" grade={onWhite} label="白文字" />
          <ContrastRow bg={swatch.hex} fg="#000000" grade={onBlack} label="黒文字" />
        </div>

        <div className="sheet-scale">
          <div className="scale-head">
            <span className="shades-label">カラースケール 50–900</span>
            <button
              type="button"
              className="scale-copy-css"
              onClick={() => copy(scaleCss, `--${slug} スケール`)}
            >
              CSS変数をコピー
            </button>
          </div>
          <div className="scale-row">
            {scale.map((s) => (
              <button
                key={s.step}
                type="button"
                className="scale-stop"
                onClick={() => copy(s.hex, `${s.step} ${s.hex}`)}
                aria-label={`${s.step} ${s.hex} をコピー`}
              >
                <span className="scale-swatch" style={{ background: s.hex }} aria-hidden />
                <span className="scale-step">{s.step}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="sheet-actions">
          <button
            type="button"
            className="sheet-del"
            onClick={() => {
              onRemove(swatch.id);
              onClose();
            }}
          >
            この色を削除
          </button>
          <button type="button" className="sheet-close" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

function ContrastRow({
  bg,
  fg,
  grade,
  label,
}: {
  bg: string;
  fg: string;
  grade: WcagGrade;
  label: string;
}) {
  return (
    <div className="contrast-row">
      <span className="contrast-sample" style={{ background: bg, color: fg }} aria-hidden>
        Aあ
      </span>
      <span className="contrast-name">{label}</span>
      <span className="contrast-ratio">{grade.ratio.toFixed(2)}:1</span>
      <span className="contrast-badges">
        <span className={`cbadge ${grade.aaNormal ? "ok" : "ng"}`}>AA</span>
        <span className={`cbadge ${grade.aaaNormal ? "ok" : "ng"}`}>AAA</span>
        <span className={`cbadge ${grade.aaLarge ? "ok" : "ng"}`}>AA大</span>
      </span>
    </div>
  );
}
