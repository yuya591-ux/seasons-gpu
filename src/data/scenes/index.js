// 情景レジストリ。新しい情景の追加は「データファイルを作って、ここに1行 import で足す」だけ。
// 既存は一切触らない（非破壊・疎結合）。

import summerRainDusk from './summer-rain-dusk.js'
import summerClearNoon from './summer-clear-noon.js'
import summerDuskDowntown from './summer-dusk-downtown.js'
import winterSnowNightDowntown from './winter-snow-night-downtown.js'
import summerRainNightDowntown from './summer-rain-night-downtown.js'
import summerMorningMountains from './summer-morning-mountains.js'
import summerDuskSeaside from './summer-dusk-seaside.js'
import autumnDuskCornerRoom from './autumn-dusk-corner-room.js'
import autumnRainNightCornerRoom from './autumn-rain-night-corner-room.js'
import summerMorningCornerRoom from './summer-morning-corner-room.js'
import springDuskCornerRoom from './spring-dusk-corner-room.js'
import winterSnowDuskCornerRoom from './winter-snow-dusk-corner-room.js'
import panoDemo from './pano-demo.js'
import splatDemo from './splat-demo.js'
import roomDemo from './room-demo.js'

export const SCENES = [
  summerRainDusk,
  summerClearNoon,
  summerDuskDowntown,
  winterSnowNightDowntown,
  summerRainNightDowntown,
  summerMorningMountains,
  summerDuskSeaside,
  autumnDuskCornerRoom,
  autumnRainNightCornerRoom,
  summerMorningCornerRoom,
  springDuskCornerRoom,
  winterSnowDuskCornerRoom,
  panoDemo,
  splatDemo,
  roomDemo,
]

/** 軸の組み合わせから情景を引く。未登録なら undefined。 */
export function findScene({ season, weather, time }) {
  return SCENES.find(
    (s) => s.axes.season === season && s.axes.weather === weather && s.axes.time === time,
  )
}

/** その軸の組み合わせが「実装済み（選べる）」か。 */
export function isReady(axes) {
  const s = findScene(axes)
  return !!s && s.status === 'ready'
}

/** 最初に表示する既定の情景。本アプリの核「角部屋から見回す」を最初の顔にする。 */
export const DEFAULT_SCENE =
  SCENES.find((s) => s.id === 'autumn-dusk-corner-room') ||
  SCENES.find((s) => s.status === 'ready') ||
  SCENES[0]
