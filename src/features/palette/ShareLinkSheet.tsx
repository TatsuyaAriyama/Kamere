import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import type { Swatch } from "../../store/usePaletteStore";
import { useToastStore } from "../../store/useToastStore";
import { copyText } from "../../lib/clipboard";
import { buildShareUrl } from "../../lib/paletteShare";

type Props = {
  colors: Swatch[];
  onClose: () => void;
};

/** パレットを URL/QR で共有するシート。リンクを開くと相手の端末に配色が読み込まれる。 */
export default function ShareLinkSheet({ colors, onClose }: Props) {
  const showToast = useToastStore((s) => s.show);
  const url = useMemo(() => buildShareUrl(colors), [colors]);
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { margin: 1, width: 320, color: { dark: "#161A17", light: "#EDE7D9" } })
      .then((d) => alive && setQr(d))
      .catch(() => alive && setQr(null));
    return () => {
      alive = false;
    };
  }, [url]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const copyLink = async () => {
    const ok = await copyText(url);
    showToast(ok ? "リンクをコピー" : "コピーに失敗しました");
  };

  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "カメレのパレット", url });
        return;
      } catch (err) {
        if ((err as DOMException)?.name === "AbortError") return;
      }
    }
    void copyLink();
  };

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div
        className="color-sheet share-sheet"
        role="dialog"
        aria-label="リンク・QRで共有"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grip" aria-hidden />

        <div className="export-head">
          <span className="export-title">リンク・QR</span>
          <span className="export-sub">{colors.length}色を相手の端末へ</span>
        </div>

        <div className="share-qr-wrap">
          {qr ? (
            <img className="share-qr" src={qr} alt="共有用QRコード" width={220} height={220} />
          ) : (
            <div className="share-qr share-qr-empty" aria-hidden>
              QRを生成中…
            </div>
          )}
          <p className="share-hint">QRを読み取るか、リンクを送ると配色を渡せます</p>
        </div>

        <div className="share-url" title={url}>
          {url}
        </div>

        <div className="share-actions">
          <button type="button" className="share-btn" onClick={copyLink}>
            リンクをコピー
          </button>
          <button type="button" className="share-btn primary" onClick={shareLink}>
            共有
          </button>
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
