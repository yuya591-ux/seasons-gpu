// 全体の結線。器（情景データ）＋レンダラ＋音＋UI をつなぐ。

import { SCENES, DEFAULT_SCENE } from './data/scenes/index.js'
import { getState, setScene, updateSettings } from './state.js'
import { createRenderer } from './engine/renderer.js'
import { createAudio } from './audio/audio.js'
import { buildUI } from './ui/ui.js'
import { attachLookAround } from './ui/lookAround.js'
import { createTilt } from './ui/tilt.js'
import { mountSplat, unmountSplat, applySplatTilt, resetSplatTilt } from './engine/splatViewer.js'

const BASE = import.meta.env.BASE_URL || '/'

const canvas = document.getElementById('scene')
const fallback = document.getElementById('fallback')

const renderer = createRenderer(canvas)
if (!renderer) {
  // WebGL 非対応・初期化失敗時は静かにフォールバック。
  canvas.hidden = true
  if (fallback) fallback.hidden = false
} else {
  start()
}

function resolveScene(id) {
  return SCENES.find((s) => s.id === id && s.status === 'ready') || DEFAULT_SCENE
}

function start() {
  const state = getState()
  const scene = resolveScene(state.sceneId)
  const settings = state.settings

  // 遠雷の音に合わせて空をほのかに光らせる（シェーダー情景のみ反応）
  const audio = createAudio({
    onCue: (def) => {
      if (def.cue === 'thunder') renderer.triggerFlash(0.6) // 遠雷はひかえめに
    },
  })
  let splatMode = false
  // 端末の傾き: スプラット情景は3Dの見回し、それ以外はシェーダーの視差に振り分ける
  const tilt = createTilt({
    onTilt: (nx, ny) => {
      if (splatMode) applySplatTilt(nx, ny)
      else renderer.applyTilt(nx, ny)
    },
    onDisable: () => {
      if (splatMode) resetSplatTilt()
      else renderer.clearTilt()
    },
  })
  audio.setMuted(settings.muted)
  audio.setVolume(settings.volume)

  // シェーダー描画は非スプラット情景で起動する（スプラットは別ビューアで表示）
  const firstShaderScene = scene.render === 'splat' ? DEFAULT_SCENE : scene
  const ok = renderer.start(firstShaderScene, settings)
  if (!ok) {
    canvas.hidden = true
    if (fallback) fallback.hidden = false
    return
  }

  // 情景の適用。スプラット情景は3Dビューア、それ以外はシェーダー描画に振り分ける。
  // 連打切替に備え世代トークンで古い処理の状態書き換えを無効化、失敗時は通常情景へフォールバック。
  let sceneGen = 0
  async function applyScene(next) {
    const gen = ++sceneGen
    setScene(next.id)
    audio.setScene(next)
    if (next.render === 'splat') {
      splatMode = true
      canvas.style.display = 'none'
      renderer.pause()
      try {
        // 読み込み中の下地は情景の空色に（黒からの唐突な切替を避ける）
        const bg = (next.palette && next.palette.early && next.palette.early.skyMid) || null
        await mountSplat(document.body, BASE + next.splatUrl, next.splatMode || 'orbit', bg)
        // 読み込み中に新しい情景へ切替わっていたら、出来上がったスプラットを片付けて譲る
        if (gen !== sceneGen) {
          await unmountSplat()
          return
        }
      } catch (e) {
        console.error('スプラット読み込み失敗→通常情景へ:', e)
        await unmountSplat()
        if (gen !== sceneGen) return
        splatMode = false
        canvas.style.display = ''
        renderer.resume()
        renderer.setScene(DEFAULT_SCENE)
      }
    } else {
      if (splatMode) {
        splatMode = false
        await unmountSplat()
        if (gen !== sceneGen) return
        canvas.style.display = ''
        renderer.resume()
      }
      if (gen !== sceneGen) return
      renderer.setScene(next)
    }
  }

  buildUI({
    initialScene: scene,
    settings,
    onApplyScene(next) {
      applyScene(next)
    },
    onSettings(patch) {
      updateSettings(patch)
      renderer.setSettings(getState().settings)
      if (patch.tilt !== undefined) {
        if (patch.tilt) {
          tilt.enable().then((ok) => {
            if (!ok) updateSettings({ tilt: false }) // 許可拒否なら設定を戻す
          })
        } else {
          tilt.disable()
        }
      }
    },
    onAudioStart() {
      return audio.start()
    },
    onToggleMute(muted) {
      updateSettings({ muted })
      audio.setMuted(muted)
    },
    onVolume(v) {
      updateSettings({ volume: v })
      audio.setVolume(v)
    },
  })

  // 開発時のみ: コンソール/検証から描画を触れるようにする（遠雷フラッシュの確認など）
  if (/[?&]dev=1/.test(location.search)) window.__renderer = renderer

  // 起動時の情景を適用（スプラットなら3Dビューアへ）
  applyScene(scene)

  // 指スワイプで景色を見回す（窓辺シリーズで有効）
  attachLookAround(canvas, renderer)
}
