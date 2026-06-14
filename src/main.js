// 全体の結線。器（情景データ）＋レンダラ＋音＋UI をつなぐ。

import { SCENES, DEFAULT_SCENE } from './data/scenes/index.js'
import { getState, setScene, updateSettings } from './state.js'
import { createRenderer } from './engine/renderer.js'
import { createAudio } from './audio/audio.js'
import { buildUI } from './ui/ui.js'
import { attachLookAround } from './ui/lookAround.js'
import { createTilt } from './ui/tilt.js'
import { mountSplat, unmountSplat } from './engine/splatViewer.js'

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

  const audio = createAudio()
  const tilt = createTilt(renderer)
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
  let splatMode = false
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
        await mountSplat(document.body, BASE + next.splatUrl)
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
        if (patch.tilt) tilt.enable()
        else tilt.disable()
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

  // 起動時の情景を適用（スプラットなら3Dビューアへ）
  applyScene(scene)

  // 指スワイプで景色を見回す（窓辺シリーズで有効）
  attachLookAround(canvas, renderer)
}
