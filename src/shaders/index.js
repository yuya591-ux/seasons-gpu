// シェーダー登録簿。情景の render 種別から、対応するシェーダーを引く。
// 新しい現象（雪など）を足すときは、ここに1行 import で追加する。

import * as rainGlass from './rainGlass.js'
import * as clearSky from './clearSky.js'
import * as windowTown from './windowTown.js'
import * as windowMountains from './windowMountains.js'
import * as windowSea from './windowSea.js'
import * as windowPano from './windowPano.js'
import * as cornerRoom from './cornerRoom.js'
import * as shishigaya from './shishigaya.js'
import * as kitateraoRooftop from './kitateraoRooftop.js'

export const SHADERS = {
  rainGlass, // 窓ガラスの雨
  clearSky, // 晴天・入道雲・陽炎
  windowTown, // 窓辺の下町（多層パララックス・見回し）
  windowMountains, // 窓辺の山あい
  windowSea, // 窓辺の海辺
  windowPano, // 立体パノラマの窓（360°写真＋深度視差）
  cornerRoom, // 高台の角部屋（室内＋窓＋街＋隣の壁の遮蔽）
  shishigaya, // 鶴見・獅子ヶ谷の谷戸（出身地の再現）
  kitateraoRooftop, // 北寺尾の屋上パノラマ（馴染みの一望風景）
}

/** render 種別からシェーダーを引く（未知なら雨ガラスにフォールバック）。 */
export function getShader(type) {
  return SHADERS[type] || SHADERS.rainGlass
}
