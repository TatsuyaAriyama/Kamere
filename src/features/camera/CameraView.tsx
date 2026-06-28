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
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing },
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

  return (
    <>
      <video
        ref={videoRef}
        className="media-fill"
        playsInline
        muted
        autoPlay
      />
      {active && (
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
