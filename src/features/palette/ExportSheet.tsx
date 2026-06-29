import { useEffect, useState } from "react";
import type { Swatch } from "../../store/usePaletteStore";
import { useToastStore } from "../../store/useToastStore";
import { copyText } from "../../lib/clipboard";
import { formatPalette, sharePalette } from "../../lib/paletteShare";
import { buildNames, downloadBlob, toAseBlob, toCssVars, toJson, toSvg } from "../../lib/exporters";
import ShareLinkSheet from "./ShareLinkSheet";

type Props = {
  colors: Swatch[];
  onClose: () => void;
};

export default function ExportSheet({ colors, onClose }: Props) {
  const showToast = useToastStore((s) => s.show);
  const [shareOpen, setShareOpen] = useState(false);

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

  const exportAse = async () => {
    const names = buildNames(colors);
    const blob = toAseBlob(colors, names);
    const ok = await downloadBlob(blob, "kamere-palette.ase");
    showToast(ok ? "ASE を書き出し" : "書き出しに失敗しました");
  };

  const share = async () => {
    const r = await sharePalette(colors);
    if (r === "copied") showToast(`${colors.length}色をコピー`);
    else if (r === "failed") showToast("共有できませんでした");
  };

  const rows: { key: string; desc: string; run: () => void }[] = [
    { key: "リンク・QR", desc: "URL/QRで配色を渡す", run: () => setShareOpen(true) },
    { key: "テキスト", desc: "HEXと色名の一覧", run: () => copy(formatPalette(colors), "テキスト") },
    { key: "CSS変数", desc: ":root のカスタムプロパティ", run: () => copy(toCssVars(colors), "CSS変数") },
    { key: "JSON", desc: "name / hex / rgb の配列", run: () => copy(toJson(colors), "JSON") },
    { key: "SVG", desc: "スウォッチ帯（Figmaに貼付可）", run: () => copy(toSvg(colors), "SVG") },
    { key: "ASE", desc: "Adobe スウォッチ（.ase 保存）", run: exportAse },
    { key: "共有", desc: "他アプリへ送る", run: share },
  ];

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div
        className="color-sheet export-sheet"
        role="dialog"
        aria-label="パレットを書き出す"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grip" aria-hidden />

        <div className="export-head">
          <span className="export-title">書き出す</span>
          <span className="export-sub">{colors.length}色をデザインツールへ</span>
        </div>

        <div className="export-list">
          {rows.map((r) => (
            <button
              key={r.key}
              type="button"
              className="export-row"
              onClick={r.run}
              aria-label={`${r.key} で書き出す`}
            >
              <span className="export-key">{r.key}</span>
              <span className="export-desc">{r.desc}</span>
              <span className="export-go" aria-hidden>
                ›
              </span>
            </button>
          ))}
        </div>

        <div className="sheet-actions">
          <button type="button" className="sheet-close" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>

      {shareOpen && <ShareLinkSheet colors={colors} onClose={() => setShareOpen(false)} />}
    </div>
  );
}
