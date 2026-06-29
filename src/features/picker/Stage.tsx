import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import CameraView from "../camera/CameraView";
import PhotoView from "../photo/PhotoView";
import Chameleon from "../chameleon/Chameleon";
import Tongue, { type GrabRequest } from "../chameleon/Tongue";
import Loupe from "./Loupe";
import { useChameleonStore } from "../../store/useChameleonStore";
import { usePaletteStore } from "../../store/usePaletteStore";
import { useToastStore } from "../../store/useToastStore";
import { useCollectionStore } from "../../store/useCollectionStore";
import { putPhoto } from "../../lib/dexPhotos";
import { grabHaptic } from "../../lib/haptics";
import { rgbToHex, type RGB } from "../../lib/color";
import { systematicName } from "../../lib/colorName";
import { extractPalette } from "../../lib/extract";
import type { ColorSourceHandle, SourceErrorKind } from "./source";

const LONG_PRESS = 260; // ms
const THUMB_SIZE = 320; // 発見アルバムの証拠写真の一辺(px)

/** 採取点まわりの正方クロップを JPEG dataURL 化（発見アルバム用）。失敗時は null。 */
function makeThumb(handle: ColorSourceHandle, clientX: number, clientY: number): string | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = THUMB_SIZE;
    canvas.height = THUMB_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    if (!handle.drawThumb(ctx, clientX, clientY, THUMB_SIZE)) return null;
    return canvas.toDataURL("image/jpeg", 0.8);
  } catch {
    return null;
  }
}

type Props = {
  source: "camera" | "photo";
  onCameraError: (kind: SourceErrorKind) => void;
};

type Point = { x: number; y: number };

export default function Stage({ source, onCameraError }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const camRef = useRef<ColorSourceHandle>(null);
  const photoRef = useRef<ColorSourceHandle>(null);
  const sizeRef = useRef<{ w: number; h: number } | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const setPos = useChameleonStore((s) => s.setPos);
  const setPhase = useChameleonStore((s) => s.setPhase);
  const setBodyColor = useChameleonStore((s) => s.setBodyColor);
  const setFacing = useChameleonStore((s) => s.setFacing);
  const setAim = useChameleonStore((s) => s.setAim);
  const addColor = usePaletteStore((s) => s.add);
  const discover = useCollectionStore((s) => s.discover);
  const showToast = useToastStore((s) => s.show);

  const activeHandle = useCallback(
    () => (source === "camera" ? camRef.current : photoRef.current),
    [source],
  );

  // ── ステージ寸法計測 + カメレオン初期配置 ──────────────
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const next = { w: r.width, h: r.height };
      sizeRef.current = next;
      setSize(next);
      const { pos } = useChameleonStore.getState();
      if (pos.x === 0 && pos.y === 0 && r.width > 0) {
        // 画面下に止まり木で佇む定位置（口元基準）
        setPos({ x: r.width * 0.34, y: r.height - 96 });
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [setPos]);

  const toLocal = useCallback((clientX: number, clientY: number): Point => {
    const r = stageRef.current?.getBoundingClientRect();
    return { x: clientX - (r?.left ?? 0), y: clientY - (r?.top ?? 0) };
  }, []);

  const localToClient = useCallback((p: Point): Point => {
    const r = stageRef.current?.getBoundingClientRect();
    return { x: p.x + (r?.left ?? 0), y: p.y + (r?.top ?? 0) };
  }, []);

  // ── グラブ（舌）ライフサイクル ──────────────────────
  const grabIdRef = useRef(0);
  const pendingRef = useRef<{ rgb: RGB; hex: string; thumb: string | null } | null>(null);
  const [grab, setGrab] = useState<GrabRequest | null>(null);

  const triggerGrab = useCallback(
    (sampleLocal: Point, toLocalPt: Point) => {
      if (useChameleonStore.getState().phase === "grabbing") return;
      const client = localToClient(sampleLocal);
      const handle = activeHandle();
      // 採色確定はノイズに強いエリア平均で。未対応時は単一pxへフォールバック。
      const rgb = handle?.sampleAreaAt(client.x, client.y) ?? handle?.sampleAt(client.x, client.y) ?? null;
      if (!rgb) {
        showToast("ここでは色を採れません");
        return;
      }
      const hex = rgbToHex(rgb);
      // 図鑑（カメラ採取のみ）の証拠写真を、採取した瞬間のフレームから切り出して保持。
      const thumb = source === "camera" && handle ? makeThumb(handle, client.x, client.y) : null;
      pendingRef.current = { rgb, hex, thumb };
      const from = useChameleonStore.getState().pos;
      // 標的の方へ向き直り、目線を固定（照準）
      setFacing(toLocalPt.x >= from.x ? 1 : -1);
      setAim(toLocalPt);
      setGrab({ id: ++grabIdRef.current, from, to: toLocalPt, color: hex });
    },
    [source, activeHandle, localToClient, showToast, setFacing, setAim],
  );

  const onTongueStart = useCallback(() => setPhase("grabbing"), [setPhase]);

  const onTongueCommit = useCallback(() => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    setGrab(null);
    setPhase("idle");
    setAim(null);
    if (!pending) return;
    const { near } = addColor(pending.rgb);
    // 図鑑はカメラで実際に探して採った色だけが記録される（攻略性を高める）。
    const found = source === "camera" ? discover(pending.rgb) : null;
    // 初発見なら、採取した瞬間の証拠写真を発見アルバムへ保存。
    if (found?.isNew && pending.thumb) void putPhoto(found.color.romaji, pending.thumb);
    setBodyColor(pending.hex);
    void grabHaptic();
    // 採った瞬間に色名を提示。重複なら無言で溜めず知らせる。
    const name = systematicName(pending.rgb);
    if (near) showToast(`${name}（同じ色は採取済み）`);
    else if (found?.isNew) showToast(`${name} を採取 ・ 図鑑に「${found.color.ja}」を発見！`);
    else showToast(`${name} を採取`);
  }, [source, addColor, discover, setBodyColor, setPhase, setAim, showToast]);

  // ── 画像全体から配色を一括抽出 ──────────────────────
  const onExtract = useCallback(() => {
    const data = activeHandle()?.snapshot(96) ?? null;
    if (!data) {
      showToast("ここでは配色を採れません");
      return;
    }
    const palette = extractPalette(data, 6);
    if (palette.length === 0) {
      showToast("色を抽出できませんでした");
      return;
    }
    // 図鑑はカメラ採取のみ反映（写真からの一括抽出は対象外）。
    const toDex = source === "camera";
    let added = 0;
    let found = 0;
    let lastHex: string | null = null;
    for (const rgb of palette) {
      const { near, swatch } = addColor(rgb);
      if (!near) added += 1;
      if (toDex && discover(rgb).isNew) found += 1;
      lastHex = swatch.hex;
    }
    if (lastHex) setBodyColor(lastHex);
    void grabHaptic();
    if (added > 0) {
      showToast(found > 0 ? `配色から ${added}色を追加 ・ 図鑑に ${found}件発見！` : `配色から ${added}色を追加`);
    } else {
      showToast("すべて採取済みの配色でした");
    }
  }, [source, activeHandle, addColor, discover, setBodyColor, showToast]);

  // ドラッグ離し（カメレオン本体）— 採色はしない（定位置維持）
  const onPickRelease = useCallback((_local: Point) => {}, []);

  // ── 長押し → ルーペ照準ルート ──────────────────────
  const [loupe, setLoupe] = useState<{ local: Point; client: Point; hex: string | null } | null>(
    null,
  );
  const pressRef = useRef<{
    timer: number;
    pointerId: number;
    client: Point;
    start: Point;
    startedAt: number;
    moved: boolean;
  } | null>(null);

  const sampleHex = useCallback(
    (client: Point): string | null => {
      const rgb = activeHandle()?.sampleAt(client.x, client.y);
      return rgb ? rgbToHex(rgb) : null;
    },
    [activeHandle],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    const target = e.target as Element;
    if (target.closest(".chameleon") || target.closest("button") || target.closest("label")) return;
    if (useChameleonStore.getState().phase === "grabbing") return;
    const client = { x: e.clientX, y: e.clientY };
    stageRef.current?.setPointerCapture?.(e.pointerId);
    const timer = window.setTimeout(() => {
      setLoupe({ local: toLocal(client.x, client.y), client, hex: sampleHex(client) });
    }, LONG_PRESS);
    pressRef.current = {
      timer,
      pointerId: e.pointerId,
      client,
      start: client,
      startedAt: performance.now(),
      moved: false,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const p = pressRef.current;
    if (!p || e.pointerId !== p.pointerId) return;
    const client = { x: e.clientX, y: e.clientY };
    p.client = client;
    if (Math.hypot(client.x - p.start.x, client.y - p.start.y) > 8) p.moved = true;
    setLoupe((cur) =>
      cur ? { local: toLocal(client.x, client.y), client, hex: sampleHex(client) } : cur,
    );
  };

  const endPress = (e: React.PointerEvent) => {
    const p = pressRef.current;
    if (!p || e.pointerId !== p.pointerId) return;
    window.clearTimeout(p.timer);
    stageRef.current?.releasePointerCapture?.(e.pointerId);
    pressRef.current = null;
    if (loupe) {
      // 長押し照準 → 照準点へ舌を飛ばす
      const local = toLocal(p.client.x, p.client.y);
      setLoupe(null);
      triggerGrab(local, local);
    } else if (!p.moved && performance.now() - p.startedAt < LONG_PRESS) {
      // 素早いタップ → その点へ舌を飛ばす
      const local = toLocal(p.client.x, p.client.y);
      triggerGrab(local, local);
    }
  };

  useEffect(() => {
    return () => {
      if (pressRef.current) window.clearTimeout(pressRef.current.timer);
    };
  }, []);

  return (
    <main
      ref={stageRef}
      className="stage"
      aria-label="ステージ"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPress}
      onPointerCancel={endPress}
    >
      <CameraView ref={camRef} active={source === "camera"} onError={onCameraError} />
      <PhotoView ref={photoRef} active={source === "photo"} />

      <Chameleon toLocal={toLocal} onPickRelease={onPickRelease} />

      <Tongue
        grab={grab}
        width={size.w}
        height={size.h}
        onStart={onTongueStart}
        onCommit={onTongueCommit}
      />

      <Loupe
        visible={!!loupe}
        localX={loupe?.local.x ?? 0}
        localY={loupe?.local.y ?? 0}
        clientX={loupe?.client.x ?? 0}
        clientY={loupe?.client.y ?? 0}
        hex={loupe?.hex ?? null}
        source={activeHandle()}
      />

      <button
        type="button"
        className="extract-btn"
        aria-label="画像全体から配色を抽出"
        onClick={onExtract}
      >
        配色を抽出
      </button>
    </main>
  );
}
