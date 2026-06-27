// アプリの状態と保存（最後に選んだ情景＋設定を覚える程度）。
// localStorage が使えない環境でも落ちないようにする。

const KEY = 'seasons.state.v1'

// 初回だけ端末性能から初期品質を推定（非力な端末は軽く始めて第一印象の滑らかさを守る）。
// 一度でも品質を選んだ人＝保存値を尊重（ここは新規利用者のみに効く）。
// 方針=「鮮明さ優先」: capable端末は標準(鮮明)のまま始め、明確に非力な端末だけ軽量で始める。
// 重要: navigator.deviceMemory は iOS Safari では未提供（undefined）。旧コードの `mem||4 → mem<=3`
// は iOS で永遠に発火せず（4扱い）、逆に「不在＝非力」と決めつけると全iPhoneが降格して鮮明さを損なう。
// → deviceMemory は「取れた時だけ」低RAM判定に使い、不在を非力とみなさない。
// 旧型iPhone(A9/A10世代=iPhone 6s/7/SE1)等は論理コアが2で報告される＝ここで拾う。
// それ以外（熱いと感じる現行機を含む capable 端末）は標準を維持し、走行中の自動品質(curPR/renderScale)を
// 実測ベースの安全網にする（=先回りで眠くしない）。
function autoQuality() {
  try {
    const cores = navigator.hardwareConcurrency || 4
    const mem = navigator.deviceMemory // 一部ブラウザのみ（iOSは undefined）
    if (cores <= 2) return 'light' // 明確に非力（旧型スマホ）。論理コア2以下
    if (typeof mem === 'number' && mem <= 2) return 'light' // 低RAM端末（取れた時だけ・2GB以下）
    return 'standard' // 既定は標準（鮮明）。こまやか=soft は手動選択に委ねる
  } catch {
    return 'standard'
  }
}

const DEFAULTS = {
  sceneId: null, // null のときは DEFAULT_SCENE を使う
  sceneAt: 0, // 最後に情景を選んだ時刻(ms)。近いうちに開き直したら「昨日(さっき)の続き」へ戻す＝連続性（古ければ今の時刻の情景へ）
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
  state.sceneAt = Date.now() // 連続性の判定用＝最後に居た時刻
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
