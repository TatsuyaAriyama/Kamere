import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { ColorSourceHandle, SourceErrorKind } from "../picker/source";
import {
  captureFrame,
  clientToMediaPixel,
  drawSnapshot,
  getDisplayedRect,
  sampleSourceArea,
  sampleSourcePixel,
  type Drawable,
} from "../../lib/sampling";

type Facing = "environment" | "user";

type Props = {
  active: boolean;
  /** 固定（フリーズ）中はライブ映像ではなく静止キャンバスから採色する。 */
  frozen?: boolean;
  onError: (kind: SourceErrorKind) => void;
  onReady?: () => void;
};

type Src = { el: Drawable; w: number; h: number; rect: DOMRect };

/** カメラ映像。表示は object-fit: cover。固定時は静止フレームから採色し、ブレを完全に排除。 */
const CameraView = forwardRef<ColorSourceHandle, Props>(function CameraView(
  { active, frozen = false, onError, onReady },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frozenRef = useRef<HTMLCanvasElement>(null);
  const isFrozenRef = useRef(false);
  isFrozenRef.current = frozen;
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<Facing>("environment");

  useImperativeHandle(
    ref,
    (): ColorSourceHandle => {
      // 採色対象＝固定中は静止キャンバス、通常はライブ映像。
      const src = (): Src | null => {
        if (isFrozenRef.current && frozenRef.current && frozenRef.current.width > 0) {
          const c = frozenRef.current;
          return { el: c, w: c.width, h: c.height, rect: c.getBoundingClientRect() };
        }
        const v = videoRef.current;
        if (!v || !v.videoWidth) return null;
        return { el: v, w: v.videoWidth, h: v.videoHeight, rect: v.getBoundingClientRect() };
      };

      return {
        sampleAt(clientX, clientY) {
          const s = src();
          if (!s) return null;
          const p = clientToMediaPixel(s.rect, s.w, s.h, "cover", clientX, clientY);
          if (!p) return null;
          return sampleSourcePixel(s.el, p.mx, p.my);
        },
        sampleAreaAt(clientX, clientY) {
          const s = src();
          if (!s) return null;
          const p = clientToMediaPixel(s.rect, s.w, s.h, "cover", clientX, clientY);
          if (!p) return null;
          return sampleSourceArea(s.el, p.mx, p.my);
        },
        drawLoupe(ctx, clientX, clientY, destSize, zoom) {
          const s = src();
          if (!s) return false;
          const p = clientToMediaPixel(s.rect, s.w, s.h, "cover", clientX, clientY);
          if (!p) return false;
          const disp = getDisplayedRect(s.rect.width, s.rect.height, s.w, s.h, "cover");
          const cssPerNatural = disp.w / s.w;
          const cropNatural = destSize / (cssPerNatural * zoom);
          const sx = p.mx - cropNatural / 2;
          const sy = p.my - cropNatural / 2;
          ctx.imageSmoothingEnabled = false;
          ctx.clearRect(0, 0, destSize, destSize);
          try {
            ctx.drawImage(s.el, sx, sy, cropNatural, cropNatural, 0, 0, destSize, destSize);
          } catch {
            return false;
          }
          return true;
        },
        snapshot(maxDim) {
          const s = src();
          if (!s) return null;
          return drawSnapshot(s.el, s.w, s.h, maxDim);
        },
        drawThumb(ctx, clientX, clientY, destSize) {
          const s = src();
          if (!s) return false;
          const p = clientToMediaPixel(s.rect, s.w, s.h, "cover", clientX, clientY);
          if (!p) return false;
          const crop = Math.min(s.w, s.h) * 0.4;
          const sx = Math.max(0, Math.min(s.w - crop, p.mx - crop / 2));
          const sy = Math.max(0, Math.min(s.h - crop, p.my - crop / 2));
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          try {
            ctx.drawImage(s.el, sx, sy, crop, crop, 0, 0, destSize, destSize);
          } catch {
            return false;
          }
          return true;
        },
        capturePhoto(maxDim) {
          const s = src();
          if (!s) return null;
          return captureFrame(s.el, s.w, s.h, maxDim);
        },
      };
    },
    [],
  );

  // 固定（フリーズ）開始時に、その瞬間のライブフレームを静止キャンバスへ等倍で焼き込む。
  useEffect(() => {
    if (!frozen) return;
    const v = videoRef.current;
    const c = frozenRef.current;
    if (!v || !c || !v.videoWidth) return;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d");
    if (ctx) {
      try {
        ctx.drawImage(v, 0, 0);
      } catch {
        /* CORS等。固定できない場合はライブのまま。 */
      }
    }
  }, [frozen]);

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

  // 非アクティブ時は <video> を描画しない（ソース未設定の <video> が出すネイティブ再生ボタン対策）。
  if (!active) return null;

  return (
    <>
      <video
        ref={videoRef}
        className="media-fill"
        playsInline
        muted
        autoPlay
        style={{ display: frozen ? "none" : "block" }}
      />
      <canvas
        ref={frozenRef}
        className="media-fill"
        style={{ display: frozen ? "block" : "none" }}
        aria-hidden
      />
      {!frozen && (
        <button
          type="button"
          className="cam-flip"
          aria-label="カメラの前後を切り替え"
          onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
        >
          ⟲
        </button>
      )}
    </>
  );
});

export default CameraView;
