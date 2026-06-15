// アプリの状態と保存（最後に選んだ情景＋設定を覚える程度）。
// localStorage が使えない環境でも落ちないようにする。

const KEY = 'seasons.state.v1'

// 初回だけ端末性能から初期品質を推定（非力な端末は軽く始めて第一印象の滑らかさを守る）。
// 一度でも品質を選んだ人＝保存値を尊重（ここは新規利用者のみに効く）。
function autoQuality() {
  try {
    const mem = navigator.deviceMemory || 4 // GB（非対応ブラウザは4扱い）
    const cores = navigator.hardwareConcurrency || 4
    if (mem <= 3 || cores <= 3) return 'light' // 非力な端末は軽量で
    return 'standard' // 既定は標準（こまやか=soft は手動選択に委ねる＝重さの事故を防ぐ）
  } catch {
    return 'standard'
  }
}

const DEFAULTS = {
  sceneId: null, // null のときは DEFAULT_SCENE を使う
  settings: {
    rain: 0.65, // 雨脚 0..1
    brightness: 1.0, // 画面の明るさ 0.7..1.3
    quality: autoQuality(), // 'soft'(なめらか) | 'standard'(標準) | 'light'(軽量)
    tilt: false, // 端末の傾きで見回す
    muted: false,
    volume: 0.8, // 全体音量 0..1
  },
}

function read() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return structuredClone(DEFAULTS)
    const parsed = JSON.parse(raw)
    return {
      ...structuredClone(DEFAULTS),
      ...parsed,
      settings: { ...DEFAULTS.settings, ...(parsed.settings || {}) },
    }
  } catch {
    return structuredClone(DEFAULTS)
  }
}

const state = read()

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // プライベートモード等では保存を諦める（動作は継続）
  }
}

export function getState() {
  return state
}

export function setScene(id) {
  state.sceneId = id
  persist()
}

export function updateSettings(patch) {
  Object.assign(state.settings, patch)
  persist()
}
