import { useEffect, useMemo, useState } from "react";
import { useInspoStore, type InspoCard } from "../../store/useInspoStore";
import { usePaletteStore, type Swatch } from "../../store/usePaletteStore";
import { useToastStore } from "../../store/useToastStore";
import { getAllInspoPhotos, removeInspoPhoto } from "../../lib/inspoPhotos";
import { nearestColorName, systematicName } from "../../lib/colorName";
import { exportInspoCardImage } from "../../lib/cardImage";
import ExportSheet from "../palette/ExportSheet";

type Props = {
  onClose: () => void;
};

function fmtDate(at: number): string {
  return new Date(at).toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** インスピ・キャプチャのギャラリー。撮った写真＋配色のカードを振り返る。 */
export default function InspoGallery({ onClose }: Props) {
  const cards = useInspoStore((s) => s.cards);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const detail = useMemo(() => cards.find((c) => c.id === openId) ?? null, [cards, openId]);

  useEffect(() => {
    let alive = true;
    getAllInspoPhotos().then((p) => alive && setPhotos(p));
    return () => {
      alive = false;
    };
  }, [cards]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (openId) setOpenId(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, openId]);

  return (
    <div className="design-mode" role="dialog" aria-label="インスピ">
      <header className="dm-bar">
        <span className="dm-title">インスピ</span>
        <button type="button" className="dm-close" aria-label="インスピを閉じる" onClick={onClose}>
          ×
        </button>
      </header>

      <div className="dm-scroll">
        {cards.length === 0 ? (
          <p className="inspo-empty">
            気になった景色をシャッターで撮ると、写真とそこから採れた配色が
            「インスピカード」として残ります。散歩のお供にどうぞ。
          </p>
        ) : (
          <div className="inspo-feed">
            {cards.map((c) => (
              <button
                key={c.id}
                type="button"
                className="inspo-card"
                aria-label={`${fmtDate(c.at)} のインスピを見る`}
                onClick={() => setOpenId(c.id)}
              >
                <span className="inspo-card-photo">
                  {photos[c.id] ? (
                    <img src={photos[c.id]} alt="" />
                  ) : (
                    <span className="inspo-card-noimg" aria-hidden />
                  )}
                </span>
                <span className="inspo-card-body">
                  <span className="inspo-card-pal" aria-hidden>
                    {c.palette.map((s, i) => (
                      <span key={i} className="inspo-card-sw" style={{ background: s.hex }} />
                    ))}
                  </span>
                  <span className="inspo-card-meta">
                    {c.palette.length}色 ・ {fmtDate(c.at)}
                    {c.note ? ` ・ ${c.note}` : ""}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {detail && (
        <InspoDetail
          card={detail}
          photo={photos[detail.id] ?? null}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

function InspoDetail({
  card,
  photo,
  onClose,
}: {
  card: InspoCard;
  photo: string | null;
  onClose: () => void;
}) {
  const remove = useInspoStore((s) => s.remove);
  const setNote = useInspoStore((s) => s.setNote);
  const addColor = usePaletteStore((s) => s.add);
  const showToast = useToastStore((s) => s.show);
  const [note, setLocalNote] = useState(card.note ?? "");
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);

  const saveImage = async () => {
    if (saving) return;
    setSaving(true);
    showToast("カード画像を作成中…");
    const r = await exportInspoCardImage(card, photo);
    setSaving(false);
    if (r === "downloaded") showToast("カード画像を保存しました");
    else if (r === "failed") showToast("画像を作成できませんでした");
  };

  const adopt = () => {
    let n = 0;
    for (const s of card.palette) {
      const { near } = addColor(s.rgb);
      if (!near) n += 1;
    }
    showToast(n > 0 ? `${n}色を採用しました` : "すべて採取済みでした");
  };

  const del = () => {
    if (!window.confirm("このインスピを削除します。よろしいですか？")) return;
    remove(card.id);
    void removeInspoPhoto(card.id);
    showToast("インスピを削除しました");
    onClose();
  };

  const saveNote = () => {
    const trimmed = note.trim();
    if (trimmed !== (card.note ?? "")) setNote(card.id, trimmed);
  };

  // ExportSheet 用に InspoSwatch を Swatch へ変換。
  const swatches: Swatch[] = card.palette.map((s, i) => ({
    id: `${card.id}-${i}`,
    hex: s.hex,
    rgb: s.rgb,
    at: card.at,
  }));

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div
        className="color-sheet inspo-detail"
        role="dialog"
        aria-label="インスピの詳細"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grip" aria-hidden />

        {photo && <img className="inspo-detail-photo" src={photo} alt="撮ったインスピ" />}

        <div className="inspo-detail-pal">
          {card.palette.map((s, i) => {
            const sys = systematicName(s.rgb);
            const trad = nearestColorName(s.rgb).color.ja;
            return (
              <div key={i} className="inspo-pal-row">
                <span className="inspo-pal-sw" style={{ background: s.hex }} aria-hidden />
                <span className="inspo-pal-name">
                  {sys}
                  <span className="inspo-pal-trad">（{trad}）</span>
                </span>
                <span className="inspo-pal-hex">{s.hex}</span>
              </div>
            );
          })}
        </div>

        <textarea
          className="inspo-note"
          placeholder="メモ（例: この縫製、秋コート案）"
          value={note}
          maxLength={120}
          onChange={(e) => setLocalNote(e.target.value)}
          onBlur={saveNote}
        />

        <button
          type="button"
          className="inspo-card-export"
          onClick={saveImage}
          disabled={saving}
        >
          配色カードを画像で書き出す
        </button>

        <div className="inspo-actions">
          <button type="button" className="inspo-act" onClick={adopt}>
            パレットに採用
          </button>
          <button type="button" className="inspo-act" onClick={() => setExporting(true)}>
            コード書き出し
          </button>
          <button type="button" className="inspo-act danger" onClick={del}>
            削除
          </button>
        </div>

        <div className="inspo-detail-foot">{fmtDate(card.at)}</div>

        <div className="sheet-actions">
          <button type="button" className="sheet-close" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>

      {exporting && <ExportSheet colors={swatches} onClose={() => setExporting(false)} />}
    </div>
  );
}
