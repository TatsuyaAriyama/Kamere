import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import type { ColorSourceHandle } from "../picker/source";
import {
  captureFrame,
  clientToMediaPixel,
  drawSnapshot,
  getDisplayedRect,
  sampleSourceArea,
  sampleSourcePixel,
} from "../../lib/sampling";

type Props = {
  active: boolean;
};

/** 写真ソース。読み込み画像を object-fit: contain で表示し、自然解像度からサンプリング。 */
const PhotoView = forwardRef<ColorSourceHandle, Props>(function PhotoView({ active }, ref) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [src, setSrc] = useState<string | null>(null);

  useImperativeHandle(
    ref,
    (): ColorSourceHandle => ({
      sampleAt(clientX, clientY) {
        const img = imgRef.current;
        if (!img || !img.naturalWidth) return null;
        const rect = img.getBoundingClientRect();
        const p = clientToMediaPixel(rect, img.naturalWidth, img.naturalHeight, "contain", clientX, clientY);
        if (!p) return null;
        return sampleSourcePixel(img, p.mx, p.my);
      },
      sampleAreaAt(clientX, clientY) {
        const img = imgRef.current;
        if (!img || !img.naturalWidth) return null;
        const rect = img.getBoundingClientRect();
        const p = clientToMediaPixel(rect, img.naturalWidth, img.naturalHeight, "contain", clientX, clientY);
        if (!p) return null;
        return sampleSourceArea(img, p.mx, p.my);
      },
      drawLoupe(ctx, clientX, clientY, destSize, zoom) {
        const img = imgRef.current;
        if (!img || !img.naturalWidth) return false;
        const rect = img.getBoundingClientRect();
        const p = clientToMediaPixel(rect, img.naturalWidth, img.naturalHeight, "contain", clientX, clientY);
        if (!p) return false;
        const disp = getDisplayedRect(rect.width, rect.height, img.naturalWidth, img.naturalHeight, "contain");
        const cssPerNatural = disp.w / img.naturalWidth;
        const cropNatural = destSize / (cssPerNatural * zoom);
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, destSize, destSize);
        try {
          ctx.drawImage(
            img,
            p.mx - cropNatural / 2,
            p.my - cropNatural / 2,
            cropNatural,
            cropNatural,
            0,
            0,
            destSize,
            destSize,
          );
        } catch {
          return false;
        }
        return true;
      },
      snapshot(maxDim) {
        const img = imgRef.current;
        if (!img || !img.naturalWidth) return null;
        return drawSnapshot(img, img.naturalWidth, img.naturalHeight, maxDim);
      },
      drawThumb(ctx, clientX, clientY, destSize) {
        const img = imgRef.current;
        if (!img || !img.naturalWidth) return false;
        const rect = img.getBoundingClientRect();
        const p = clientToMediaPixel(rect, img.naturalWidth, img.naturalHeight, "contain", clientX, clientY);
        if (!p) return false;
        const crop = Math.min(img.naturalWidth, img.naturalHeight) * 0.4;
        const sx = Math.max(0, Math.min(img.naturalWidth - crop, p.mx - crop / 2));
        const sy = Math.max(0, Math.min(img.naturalHeight - crop, p.my - crop / 2));
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        try {
          ctx.drawImage(img, sx, sy, crop, crop, 0, 0, destSize, destSize);
        } catch {
          return false;
        }
        return true;
      },
      capturePhoto(maxDim) {
        const img = imgRef.current;
        if (!img || !img.naturalWidth) return null;
        return captureFrame(img, img.naturalWidth, img.naturalHeight, maxDim);
      },
    }),
    [],
  );

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  if (!active) return null;

  return (
    <>
      {src ? (
        <img ref={imgRef} className="media-fill media-contain" src={src} alt="読み込んだ写真" />
      ) : (
        <label className="photo-empty">
          <span className="photo-empty-title">写真を選ぶ</span>
          <span className="photo-empty-sub">タップして画像を読み込み、色を採る</span>
          <input type="file" accept="image/*" onChange={onPick} hidden />
        </label>
      )}
      {src && (
        <label className="photo-replace" aria-label="写真を選び直す">
          画像を変更
          <input type="file" accept="image/*" onChange={onPick} hidden />
        </label>
      )}
    </>
  );
});

export default PhotoView;
