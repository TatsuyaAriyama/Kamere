import { createBlobStore } from "./blobStore";

/**
 * 発見アルバムの証拠写真ストア（IndexedDB: kamere-dex / photos）。
 * 図鑑メタデータ（軽量）は localStorage、写真（重い dataURL）はこちらに分離して保存する。
 */
const store = createBlobStore("kamere-dex", "photos");

/** 証拠写真（dataURL）を伝統色キーで保存。 */
export const putPhoto = store.put;
/** 発見済みキーすべての写真を取得（romaji → dataURL）。 */
export const getAllPhotos = store.getAll;
/** 全写真を消去（図鑑リセット時）。 */
export const clearPhotos = store.clear;
