// 色ユーティリティ。#rrggbb を 0..1 のRGB配列に変換し、2色を線形補間する。

/** '#rrggbb' -> [r,g,b]（各 0..1） */
export function hexToRgb(hex) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  return [r, g, b]
}

/** 2つのRGB配列を t(0..1) で線形補間 */
export function mixRgb(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}
