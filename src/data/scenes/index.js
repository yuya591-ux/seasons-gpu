// 情景レジストリ。新しい情景の追加は「データファイルを作って、ここに1行 import で足す」だけ。
// 既存は一切触らない（非破壊・疎結合）。

import photoWindowTown from './photo-window-town.js'
import summerRainDusk from './summer-rain-dusk.js'
import summerRainNight from './summer-rain-night.js'
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
import springMorningCornerRoom from './spring-morning-corner-room.js'
import winterSnowDuskCornerRoom from './winter-snow-dusk-corner-room.js'
import shishigayaMorningYato from './shishigaya-morning-yato.js'
import kitateraoRooftop from './kitaterao-rooftop.js'
import kitateraoRooftopNight from './kitaterao-rooftop-night.js'
import kitateraoWindow3d from './kitaterao-window-3d.js'
import kitateraoWindow3dNight from './kitaterao-window-3d-night.js'
import kitateraoWindow3dSnow from './kitaterao-window-3d-snow.js'
import kitateraoWindow3dSpring from './kitaterao-window-3d-spring.js'
import kitateraoWindow3dAutumn from './kitaterao-window-3d-autumn.js'
import shishigayaWindow3d from './shishigaya-window-3d.js'
import panoDemo from './pano-demo.js'
import splatDemo from './splat-demo.js'
import roomDemo from './room-demo.js'

export const SCENES = [
  // 実写の窓（Flux写真が主役）＝最も実写。ショーケースとして先頭に。
  photoWindowTown,
  // 本物の3Dの坂の街（四季）＝アプリの主役。ギャラリーの先頭に並べて第一印象にする。
  kitateraoWindow3d,
  kitateraoWindow3dNight,
  kitateraoWindow3dSpring,
  kitateraoWindow3dAutumn,
  kitateraoWindow3dSnow,
  shishigayaWindow3d,
  // 角部屋シリーズ（シェーダー）
  autumnDuskCornerRoom,
  autumnRainNightCornerRoom,
  summerMorningCornerRoom,
  springDuskCornerRoom,
  springMorningCornerRoom,
  winterSnowDuskCornerRoom,
  // 下町・自然・その他のシェーダー情景
  summerRainDusk,
  summerRainNight,
  summerClearNoon,
  summerDuskDowntown,
  winterSnowNightDowntown,
  summerRainNightDowntown,
  summerMorningMountains,
  summerDuskSeaside,
  shishigayaMorningYato,
  kitateraoRooftop,
  kitateraoRooftopNight,
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

/** 今の月・時刻から、季節と時間帯を求める。 */
export function nowAxes(date = new Date()) {
  const m = date.getMonth() + 1 // 1..12
  const h = date.getHours()
  const season = m <= 2 || m === 12 ? 'winter' : m <= 5 ? 'spring' : m <= 8 ? 'summer' : 'autumn'
  const time =
    h >= 5 && h < 10 ? 'morning' : h >= 10 && h < 16 ? 'noon' : h >= 16 && h < 19 ? 'dusk' : 'night'
  return { season, time }
}

/** 「いま」に最も合う公開情景を選ぶ。季節＋時間帯を重視し、核の角部屋を少し優先する。 */
export function pickNowScene(date = new Date()) {
  const { season, time } = nowAxes(date)
  const candidates = SCENES.filter((s) => s.status === 'ready' && s.public !== false)
  let best = DEFAULT_SCENE
  let bestScore = -1
  for (const s of candidates) {
    let score = 0
    if (s.axes.season === season) score += 2
    if (s.axes.time === time) score += 2
    if (s.render === 'town3d') score += 4 // 本物の3Dの街を主役に（その季節の立体の街で開く）
    else if (s.render === 'cornerRoom') score += 1 // 角部屋は次点
    if (score > bestScore) {
      bestScore = score
      best = s
    }
  }
  return best
}
