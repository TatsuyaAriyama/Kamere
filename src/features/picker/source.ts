import type { RGB } from "../../lib/color";

/** CameraView / PhotoView が公開する共通インターフェース。 */
export interface ColorSourceHandle {
  /** viewport座標の色をサンプリング（単一px・ルーペ表示用）。範囲外/無効なら null。 */
  sampleAt(clientX: number, clientY: number): RGB | null;
  /** 近傍を線形光で加重平均した代表色（採色確定用）。範囲外/無効なら null。 */
  sampleAreaAt(clientX: number, clientY: number): RGB | null;
  /**
   * client点を中心に拡大領域を ctx(destSize×destSize)へ描画。
   * 範囲内なら true。ルーペ用。
   */
  drawLoupe(
    ctx: CanvasRenderingContext2D,
    clientX: number,
    clientY: number,
    destSize: number,
    zoom: number,
  ): boolean;
  /** 現在のフレーム/画像を最大 maxDim に縮小して ImageData を返す（配色抽出用）。無効なら null。 */
  snapshot(maxDim: number): ImageData | null;
}

export type SourceErrorKind = "permission" | "notfound" | "unknown";
