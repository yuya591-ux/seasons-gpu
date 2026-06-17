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
    timeStay: false, // 時間をとどめる（時間帯の移ろいを止めて今の時刻に静止）
    muted: false,
    volume: 0.8, // 全体音量 0..1
  },
  // 通い帳: 訪れた窓辺・過ごした時間・立ち会ったまれな現象を静かに記録（達成やバッジではなく、気づいたら溜まっている記録）。
  journal: {
    visits: {}, // { sceneId: 訪れた回数 }
    seconds: 0, // 累計の眺めた秒数
    events: {}, // { rainbow|fireworks|star|aurora: 立ち会った回数 }
    firstAt: null, // 初めて窓辺に座った日時
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
      journal: {
        ...DEFAULTS.journal,
        ...(parsed.journal || {}),
        visits: { ...(parsed.journal && parsed.journal.visits) },
        events: { ...(parsed.journal && parsed.journal.events) },
      },
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

// ── 通い帳の記録（静かに溜める） ──
export function recordVisit(sceneId) {
  if (!sceneId) return
  const j = state.journal
  j.visits[sceneId] = (j.visits[sceneId] || 0) + 1
  if (!j.firstAt) j.firstAt = Date.now()
  persist()
}
export function addViewSeconds(s) {
  state.journal.seconds = (state.journal.seconds || 0) + s
  persist()
}
export function recordEvent(kind) {
  if (!kind) return
  state.journal.events[kind] = (state.journal.events[kind] || 0) + 1
  persist()
}
