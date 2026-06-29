import { createBlobStore } from "./blobStore";

/** インスピ・キャプチャの写真ストア（IndexedDB: kamere-inspo / photos）。カード id をキーに保存。 */
const store = createBlobStore("kamere-inspo", "photos");

export const putInspoPhoto = store.put;
export const getAllInspoPhotos = store.getAll;
export const removeInspoPhoto = store.remove;
export const clearInspoPhotos = store.clear;
