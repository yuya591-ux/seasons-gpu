// シェーダー登録簿。情景の render 種別から、対応するシェーダーを引く。
// 新しい現象（雪など）を足すときは、ここに1行 import で追加する。

import * as rainGlass from './rainGlass.js'
import * as clearSky from './clearSky.js'

export const SHADERS = {
  rainGlass, // 窓ガラスの雨
  clearSky, // 晴天・入道雲・陽炎
}

/** render 種別からシェーダーを引く（未知なら雨ガラスにフォールバック）。 */
export function getShader(type) {
  return SHADERS[type] || SHADERS.rainGlass
}
