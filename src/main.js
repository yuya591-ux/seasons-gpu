// 全体の結線。器（情景データ）＋レンダラ＋音＋UI をつなぐ。

import { SCENES, DEFAULT_SCENE, pickNowScene } from './data/scenes/index.js'
import { getState, setScene, updateSettings } from './state.js'
import { createRenderer } from './engine/renderer.js'
import { createAudio } from './audio/audio.js'
import { buildUI } from './ui/ui.js'
import { attachLookAround } from './ui/lookAround.js'
import { createTilt } from './ui/tilt.js'
import { mountSplat, unmountSplat, applySplatTilt, resetSplatTilt } from './engine/splatViewer.js'
import {
  mountTown3d,
  unmountTown3d,
  applyTown3dLook,
  resetTown3dLook,
  setTown3dWindowOpen,
  setTown3dLean,
} from './engine/town3dViewer.js'

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

// オフラインでも開ける（PWA）。本番のみ・対応ブラウザのみ。失敗は静かに無視。
// 一度訪れれば、電波が無くても・将来サーバが消えても眺められる（「自分がいなくなっても動く」）。
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(BASE + 'sw.js', { scope: BASE }).catch(() => {})
  })
}

function resolveScene(id) {
  return SCENES.find((s) => s.id === id && s.status === 'ready') || DEFAULT_SCENE
}

function start() {
  const state = getState()
  // 起動時は「いま（今の季節・時刻）の窓辺」を開く＝開くたび今と地続きの再訪動機。
  const scene = pickNowScene()
  const settings = state.settings

  // モーション過敏への配慮: OS設定 prefers-reduced-motion に追従して“息づかい”の揺れを止める
  const mqReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
  const applyReduceMotion = () => renderer.setReduceMotion(!!(mqReduce && mqReduce.matches))
  applyReduceMotion()
  if (mqReduce && mqReduce.addEventListener) mqReduce.addEventListener('change', applyReduceMotion)

  // 遠雷の音に合わせて空をほのかに光らせる（シェーダー情景のみ反応）
  const audio = createAudio({
    onCue: (def) => {
      if (def.cue === 'thunder') renderer.triggerFlash(0.6) // 遠雷はひかえめに
    },
  })
  let splatMode = false
  let town3dMode = false
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
  const firstShaderScene = (scene.render === 'splat' || scene.render === 'town3d') ? DEFAULT_SCENE : scene
  const ok = renderer.start(firstShaderScene, settings)
  if (!ok) {
    canvas.hidden = true
    if (fallback) fallback.hidden = false
    return
  }

  // 情景切替のなめらかな暗転オーバーレイ
  const sceneFade = document.createElement('div')
  sceneFade.className = 'scene-fade'
  document.body.appendChild(sceneFade)
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))

  // 情景の適用。スプラット情景は3Dビューア、それ以外はシェーダー描画に振り分ける。
  // 連打切替に備え世代トークンで古い処理の状態書き換えを無効化、失敗時は通常情景へフォールバック。
  let sceneGen = 0
  async function applyScene(next, animate = true) {
    const gen = ++sceneGen
    if (animate) {
      // 情景の空色へ一瞬沈める（暗転）。切替が見えてから景色を入れ替える
      sceneFade.style.background = (next.palette && next.palette.early && next.palette.early.skyMid) || '#1a1320'
      sceneFade.style.transition = 'opacity 0.25s ease'
      sceneFade.style.opacity = '1'
      await wait(260)
      if (gen !== sceneGen) return // 連打されたら新しい切替に任せる
    }
    setScene(next.id)
    audio.setScene(next)
    // 情景を替えたら窓は閉じた状態から始める（ボタンと描画のズレを防ぐ）
    renderer.setWindowOpen(false)
    if (ui && ui.resetWindow) ui.resetWindow()
    if (next.render === 'splat') {
      splatMode = true
      canvas.style.display = 'none'
      renderer.pause()
      if (town3dMode) { town3dMode = false; await unmountTown3d() }
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
    } else if (next.render === 'town3d') {
      // 本物の3Dの街（Three.js）。窓から立体の街を見下ろす。
      town3dMode = true
      canvas.style.display = 'none'
      renderer.pause()
      if (splatMode) { splatMode = false; await unmountSplat() }
      try {
        await mountTown3d(document.body, { palette: (next.palette && next.palette.early) || null })
        if (gen !== sceneGen) { await unmountTown3d(); return }
      } catch (e) {
        console.error('3Dの街 表示失敗→通常情景へ:', e)
        await unmountTown3d()
        if (gen !== sceneGen) return
        town3dMode = false
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
      if (town3dMode) {
        town3dMode = false
        await unmountTown3d()
        if (gen !== sceneGen) return
        canvas.style.display = ''
        renderer.resume()
      }
      if (gen !== sceneGen) return
      renderer.setScene(next)
    }
    // 暗転から静かに戻す（最新の切替のときだけ）
    if (animate && gen === sceneGen) {
      sceneFade.style.transition = 'opacity 0.6s ease'
      requestAnimationFrame(() => {
        sceneFade.style.opacity = '0'
      })
    }
  }

  // ── おやすみタイマー：眺めているうちに、そっと暗転して音が引いて休む（眺めて寝落ちる） ──
  // 触れればいつでも静かに戻る。暗転しきったら描画と音を止めてバッテリーも守る。
  const sleepOverlay = document.createElement('div')
  sleepOverlay.className = 'sleep-overlay'
  const sleepWord = document.createElement('p')
  sleepWord.className = 'sleep-word'
  sleepWord.textContent = 'おやすみなさい'
  sleepOverlay.appendChild(sleepWord)
  document.body.appendChild(sleepOverlay)
  let sleepTimer = 0
  let sleepFading = false
  function cancelSleep() {
    clearTimeout(sleepTimer)
    sleepTimer = 0
    if (sleepFading) {
      sleepFading = false
      sleepOverlay.classList.remove('sleep-overlay--on', 'sleep-overlay--done')
      renderer.resume()
      const st = getState().settings
      audio.setVolume(st.volume) // 音量を戻す
      audio.setMuted(st.muted)
    }
  }
  function startSleepFade() {
    sleepFading = true
    sleepOverlay.classList.add('sleep-overlay--on') // CSSで約26秒かけて暗転
    const startVol = getState().settings.volume
    const t0 = performance.now()
    const dur = 26000
    function ramp() {
      if (!sleepFading) return
      const k = Math.min(1, (performance.now() - t0) / dur)
      audio.setVolume(startVol * (1 - k)) // 音を静かに絞る
      if (k < 1) requestAnimationFrame(ramp)
      else {
        sleepOverlay.classList.add('sleep-overlay--done')
        renderer.pause() // 暗転しきったら休む（描画停止＝発熱/電池に配慮）
        audio.setMuted(true)
      }
    }
    requestAnimationFrame(ramp)
  }
  function onSleepTimer(min) {
    cancelSleep()
    if (min > 0) sleepTimer = setTimeout(startSleepFade, min * 60000)
  }
  // 眠りの暗転中に触れたら、そっと眺めへ戻す
  ;['pointerdown', 'keydown'].forEach((ev) =>
    window.addEventListener(ev, () => { if (sleepFading) cancelSleep() }, { passive: true }),
  )

  const ui = buildUI({
    initialScene: scene,
    settings,
    onApplyScene(next) {
      applyScene(next)
    },
    onSleepTimer,
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
    onToggleWindow(open) {
      if (town3dMode) setTown3dWindowOpen(open) // 3Dの街は窓ガラスがすべって開く
      else renderer.setWindowOpen(open)
    },
    onToggleLean(lean) {
      if (town3dMode) setTown3dLean(lean) // 3Dの街はカメラが枠を越えて前へ
      else renderer.setLeanOut(lean)
    },
  })

  // 開発時のみ: コンソール/検証から描画を触れるようにする（遠雷フラッシュ・サムネ生成など）
  if (/[?&]dev=1/.test(location.search)) {
    window.__renderer = renderer
    window.__applyScene = (id) => applyScene(resolveScene(id), false)
    window.__sceneIds = SCENES.filter((s) => s.public !== false && s.status === 'ready').map((s) => s.id)
    window.__town3dWindow = (b) => setTown3dWindowOpen(b) // 検証用: 3Dの街の窓をあける/しめる
    window.__town3dLean = (b) => setTown3dLean(b) // 検証用: 3Dの街で身を乗り出す/もどる
    window.__sleepNow = () => startSleepFade() // 検証用: おやすみの暗転を即時に起こす
    window.__sleepState = () => ({ fading: sleepFading, on: sleepOverlay.classList.contains('sleep-overlay--on') })
  }

  // 起動時の情景を適用（暗転なし。導入は起動ゲートが担う）
  applyScene(scene, false)

  // 指スワイプで景色を見回す（窓辺シリーズで有効）
  attachLookAround(canvas, renderer)
}
