// 全体の結線。器（情景データ）＋レンダラ＋音＋UI をつなぐ。

import { SCENES, DEFAULT_SCENE } from './data/scenes/index.js'
import { getState, setScene, updateSettings } from './state.js'
import { createRenderer } from './engine/renderer.js'
import { createAudio } from './audio/audio.js'
import { buildUI } from './ui/ui.js'

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
  audio.setMuted(settings.muted)
  audio.setVolume(settings.volume)
  // 起動時の情景を音側にも伝える（鳴り始めは最初のタップ後）
  audio.setScene(scene)

  const ok = renderer.start(scene, settings)
  if (!ok) {
    canvas.hidden = true
    if (fallback) fallback.hidden = false
    return
  }

  buildUI({
    initialScene: scene,
    settings,
    onApplyScene(next) {
      setScene(next.id)
      renderer.setScene(next)
      audio.setScene(next)
    },
    onSettings(patch) {
      updateSettings(patch)
      renderer.setSettings(getState().settings)
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
}
