// 情景レジストリ。新しい情景の追加は「データファイルを作って、ここに1行 import で足す」だけ。
// 既存は一切触らない（非破壊・疎結合）。

import summerRainDusk from './summer-rain-dusk.js'
import summerClearNoon from './summer-clear-noon.js'
import summerDuskDowntown from './summer-dusk-downtown.js'

export const SCENES = [
  summerRainDusk,
  summerClearNoon,
  summerDuskDowntown,
  // 次の情景をここに追加していく（例: 冬・雪・夜・静寂 など）
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

/** 最初に表示する既定の情景（最初の見本）。 */
export const DEFAULT_SCENE = SCENES.find((s) => s.status === 'ready') || SCENES[0]
