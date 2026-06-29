import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { ColorSourceHandle, SourceErrorKind } from "../picker/source";
import {
  clientToMediaPixel,
  drawSnapshot,
  getDisplayedRect,
  sampleSourceArea,
  sampleSourcePixel,
} from "../../lib/sampling";

type Facing = "environment" | "user";

type Props = {
  active: boolean;
  onError: (kind: SourceErrorKind) => void;
  onReady?: () => void;
};

/** カメラ映像。表示は object-fit: cover。サンプリングは映像の自然解像度から。 */
const CameraView = forwardRef<ColorSourceHandle, Props>(function CameraView(
  { active, onError, onReady },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<Facing>("environment");

  useImperativeHandle(
    ref,
    (): ColorSourceHandle => ({
      sampleAt(clientX, clientY) {
        const v = videoRef.current;
        if (!v || !v.videoWidth) return null;
        const rect = v.getBoundingClientRect();
        const p = clientToMediaPixel(rect, v.videoWidth, v.videoHeight, "cover", clientX, clientY);
        if (!p) return null;
        return sampleSourcePixel(v, p.mx, p.my);
      },
      sampleAreaAt(clientX, clientY) {
        const v = videoRef.current;
        if (!v || !v.videoWidth) return null;
        const rect = v.getBoundingClientRect();
        const p = clientToMediaPixel(rect, v.videoWidth, v.videoHeight, "cover", clientX, clientY);
        if (!p) return null;
        return sampleSourceArea(v, p.mx, p.my);
      },
      drawLoupe(ctx, clientX, clientY, destSize, zoom) {
        const v = videoRef.current;
        if (!v || !v.videoWidth) return false;
        const rect = v.getBoundingClientRect();
        const p = clientToMediaPixel(rect, v.videoWidth, v.videoHeight, "cover", clientX, clientY);
        if (!p) return false;
        // dispスケール: 自然px → CSS px。zoom倍に拡大して切り出す。
        const disp = getDisplayedRect(rect.width, rect.height, v.videoWidth, v.videoHeight, "cover");
        const cssPerNatural = disp.w / v.videoWidth;
        const cropNatural = destSize / (cssPerNatural * zoom);
        const sx = p.mx - cropNatural / 2;
        const sy = p.my - cropNatural / 2;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, destSize, destSize);
        try {
          ctx.drawImage(v, sx, sy, cropNatural, cropNatural, 0, 0, destSize, destSize);
        } catch {
          return false;
        }
        return true;
      },
      snapshot(maxDim) {
        const v = videoRef.current;
        if (!v || !v.videoWidth) return null;
        return drawSnapshot(v, v.videoWidth, v.videoHeight, maxDim);
      },
      drawThumb(ctx, clientX, clientY, destSize) {
        const v = videoRef.current;
        if (!v || !v.videoWidth) return false;
        const rect = v.getBoundingClientRect();
        const p = clientToMediaPixel(rect, v.videoWidth, v.videoHeight, "cover", clientX, clientY);
        if (!p) return false;
        // 採取点まわりの正方クロップ（フレーム短辺の約40%）を文脈ごと滑らかに描画。
        const crop = Math.min(v.videoWidth, v.videoHeight) * 0.4;
        const sx = Math.max(0, Math.min(v.videoWidth - crop, p.mx - crop / 2));
        const sy = Math.max(0, Math.min(v.videoHeight - crop, p.my - crop / 2));
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        try {
          ctx.drawImage(v, sx, sy, crop, crop, 0, 0, destSize, destSize);
        } catch {
          return false;
        }
        return true;
      },
    }),
    [],
  );

  useEffect(() => {
    if (!active) {
      // 非アクティブ時はカメラを解放
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      return;
    }

    let cancelled = false;
    async function start() {
      try {
        // できる限り高解像度を要求（ideal なので非対応端末は自動で近い値にフォールバック）。
        // 採色は映像の自然解像度からサンプリングするため、高画質ほど精度も上がる。
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facing,
            width: { ideal: 3840 },
            height: { ideal: 2160 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => {});
          onReady?.();
        }
      } catch (err) {
        if (cancelled) return;
        const name = (err as DOMException)?.name ?? "";
        if (name === "NotAllowedError" || name === "SecurityError") onError("permission");
        else if (name === "NotFoundError" || name === "OverconstrainedError") onError("notfound");
        else onError("unknown");
      }
    }
    start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [active, facing, onError, onReady]);

  // 非アクティブ時は <video> を描画しない。
  // ソース未設定の <video> は iOS WKWebView がネイティブの再生ボタン（◯＋▶）を
  // プレースホルダー表示してしまい、写真モードで動画プレイヤーのように見えるため。
  if (!active) return null;

  return (
    <>
      <video
        ref={videoRef}
        className="media-fill"
        playsInline
        muted
        autoPlay
      />
      <button
        type="button"
        className="cam-flip"
        aria-label="カメラの前後を切り替え"
        onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
      >
        ⟲
      </button>
    </>
  );
});

export default CameraView;
