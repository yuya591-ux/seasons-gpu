// 選択軸の定義。メニューは常にこの全軸を並べる（器は最初から全部入り）。
// 実際に選べるのは status:'ready' の情景に対応する組み合わせだけ。

export const SEASONS = [
  { id: 'spring', label: '春' },
  { id: 'summer', label: '夏' },
  { id: 'autumn', label: '秋' },
  { id: 'winter', label: '冬' },
]

export const WEATHERS = [
  { id: 'clear', label: '晴れ' },
  { id: 'cloudy', label: '曇り' },
  { id: 'rain', label: '雨' },
  { id: 'snow', label: '雪' },
]

export const TIMES = [
  { id: 'predawn', label: '夜明け前' },
  { id: 'dawn', label: '早朝' },
  { id: 'morning', label: '朝' },
  { id: 'noon', label: '昼' },
  { id: 'dusk', label: '夕方' },
  { id: 'night', label: '夜' },
]

/** 軸IDから表示名を引く小さなヘルパー。 */
export function labelOf(list, id) {
  const found = list.find((a) => a.id === id)
  return found ? found.label : id
}
