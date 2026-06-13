// アプリの状態と保存（最後に選んだ情景＋設定を覚える程度）。
// localStorage が使えない環境でも落ちないようにする。

const KEY = 'seasons.state.v1'

const DEFAULTS = {
  sceneId: null, // null のときは DEFAULT_SCENE を使う
  settings: {
    rain: 0.65, // 雨脚 0..1
    brightness: 1.0, // 画面の明るさ 0.7..1.3
    quality: 'standard', // 'soft'(なめらか) | 'standard'(標準) | 'light'(軽量)
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
