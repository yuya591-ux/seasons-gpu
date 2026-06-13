// 画面のUI。眺める邪魔をしないよう最小限・控えめ。無操作でHUDは静かに消える。
// 文言は静かで上質に。システム用語は出さない。

import { SEASONS, WEATHERS, TIMES, labelOf } from '../data/axes.js'
import { findScene, isReady } from '../data/scenes/index.js'

const h = (tag, cls, text) => {
  const el = document.createElement(tag)
  if (cls) el.className = cls
  if (text != null) el.textContent = text
  return el
}

export function buildUI(opts) {
  const {
    initialScene,
    settings,
    onApplyScene, // (scene) => void
    onSettings, // (patch) => void
    onAudioStart, // () => Promise<void>  最初のタップ
    onToggleMute, // (muted) => void
    onVolume, // (v) => void
  } = opts

  const root = h('div', 'ui')
  document.body.appendChild(root)

  let currentScene = initialScene
  let intensityLabelEl = null // 設定の「強さ」スライダーの名前（情景で変わる）

  // ── 起動ゲート（iOS自動再生対策） ──
  const gate = h('div', 'gate')
  gate.appendChild(h('p', 'gate__title', '眺めて、整う'))
  gate.appendChild(h('p', 'gate__lead', '画面にふれて始める'))
  root.appendChild(gate)
  gate.addEventListener('click', async () => {
    gate.classList.add('gate--hide')
    setTimeout(() => gate.remove(), 800)
    try {
      await onAudioStart()
    } catch {
      /* 音が出せなくても体験は続行 */
    }
    poke()
  })

  // ── HUD（情景名・音） ──
  const hud = h('div', 'hud')
  const sceneName = h('p', 'hud__scene', currentScene.label)
  const audioRow = h('div', 'hud__audio')
  const muteBtn = h('button', 'iconbtn', settings.muted ? '♪̸' : '♪')
  muteBtn.setAttribute('aria-label', '音のオン・オフ')
  const vol = h('input', 'slider slider--vol')
  vol.type = 'range'
  vol.min = '0'
  vol.max = '1'
  vol.step = '0.01'
  vol.value = String(settings.volume)
  audioRow.appendChild(muteBtn)
  audioRow.appendChild(vol)
  hud.appendChild(sceneName)
  hud.appendChild(audioRow)
  root.appendChild(hud)

  muteBtn.addEventListener('click', () => {
    settings.muted = !settings.muted
    muteBtn.textContent = settings.muted ? '♪̸' : '♪'
    onToggleMute(settings.muted)
    poke()
  })
  vol.addEventListener('input', () => {
    onVolume(parseFloat(vol.value))
    poke()
  })

  // ── 右上のボタン（情景・設定を開く） ──
  const topbar = h('div', 'topbar')
  const sceneBtn = h('button', 'iconbtn', '情景')
  const setBtn = h('button', 'iconbtn', '設定')
  topbar.appendChild(sceneBtn)
  topbar.appendChild(setBtn)
  root.appendChild(topbar)

  // ── 情景選択パネル ──
  const panelScene = buildScenePanel()
  root.appendChild(panelScene.el)
  sceneBtn.addEventListener('click', () => {
    panelScene.open()
    poke()
  })

  // ── 設定パネル ──
  const panelSet = buildSettingsPanel()
  root.appendChild(panelSet.el)
  setBtn.addEventListener('click', () => {
    panelSet.el.classList.add('panel--open')
    poke()
  })

  // ── 無操作で消えるHUD ──
  let idleTimer = 0
  function anyPanelOpen() {
    return (
      panelScene.el.classList.contains('panel--open') ||
      panelSet.el.classList.contains('panel--open')
    )
  }
  function poke() {
    document.body.classList.remove('idle')
    clearTimeout(idleTimer)
    idleTimer = setTimeout(() => {
      if (!anyPanelOpen()) document.body.classList.add('idle')
    }, 3500)
  }
  ;['pointermove', 'pointerdown', 'keydown', 'touchstart'].forEach((ev) =>
    window.addEventListener(ev, poke, { passive: true }),
  )
  poke()

  // ── 情景パネルの中身 ──
  function buildScenePanel() {
    const el = h('div', 'panel panel--scene')
    const head = h('div', 'panel__head')
    head.appendChild(h('h2', 'panel__title', '情景を選ぶ'))
    const close = h('button', 'iconbtn', '×')
    head.appendChild(close)
    el.appendChild(head)

    let tentative = { ...currentScene.axes }

    const axisRows = [
      { key: 'season', list: SEASONS, label: '季節' },
      { key: 'weather', list: WEATHERS, label: '天気' },
      { key: 'time', list: TIMES, label: '時間' },
    ]
    const chipEls = {}
    axisRows.forEach((row) => {
      const r = h('div', 'axis')
      r.appendChild(h('span', 'axis__label', row.label))
      const chips = h('div', 'axis__chips')
      chipEls[row.key] = []
      row.list.forEach((opt) => {
        const chip = h('button', 'chip', opt.label)
        chip.addEventListener('click', () => {
          tentative[row.key] = opt.id
          refresh()
          poke()
        })
        chips.appendChild(chip)
        chipEls[row.key].push({ id: opt.id, chip })
      })
      r.appendChild(chips)
      el.appendChild(r)
    })

    const status = h('p', 'panel__status', '')
    el.appendChild(status)
    const apply = h('button', 'primary', 'この情景にする')
    el.appendChild(apply)

    function refresh() {
      axisRows.forEach((row) => {
        chipEls[row.key].forEach(({ id, chip }) => {
          chip.classList.toggle('chip--on', tentative[row.key] === id)
        })
      })
      const ready = isReady(tentative)
      const scene = findScene(tentative)
      if (ready) {
        status.textContent = scene.label
        const same = scene.id === currentScene.id
        apply.disabled = same
        apply.textContent = same ? 'いまの情景です' : 'この情景にする'
      } else {
        status.textContent = 'この組み合わせは準備中です'
        apply.disabled = true
        apply.textContent = 'この情景にする'
      }
    }

    apply.addEventListener('click', () => {
      const scene = findScene(tentative)
      if (!scene || scene.id === currentScene.id) return
      currentScene = scene
      sceneName.textContent = scene.label
      if (intensityLabelEl) intensityLabelEl.textContent = scene.intensityLabel || '強さ'
      onApplyScene(scene)
      el.classList.remove('panel--open')
      poke()
    })
    close.addEventListener('click', () => {
      el.classList.remove('panel--open')
      poke()
    })

    return {
      el,
      open() {
        tentative = { ...currentScene.axes }
        refresh()
        el.classList.add('panel--open')
      },
    }
  }

  // ── 設定パネルの中身 ──
  function buildSettingsPanel() {
    const el = h('div', 'panel panel--set')
    const head = h('div', 'panel__head')
    head.appendChild(h('h2', 'panel__title', '設定'))
    const close = h('button', 'iconbtn', '×')
    head.appendChild(close)
    el.appendChild(head)

    const intensityRow = makeSlider(
      currentScene.intensityLabel || '強さ',
      0,
      1,
      0.01,
      settings.rain,
      (v) => {
        settings.rain = v
        onSettings({ rain: v })
      },
    )
    intensityLabelEl = intensityRow.querySelector('.setrow__label')
    el.appendChild(intensityRow)
    el.appendChild(
      makeSlider('明るさ', 0.7, 1.3, 0.01, settings.brightness, (v) => {
        settings.brightness = v
        onSettings({ brightness: v })
      }),
    )

    const qRow = h('div', 'setrow')
    qRow.appendChild(h('span', 'setrow__label', '画質'))
    const qChips = h('div', 'axis__chips')
    const QUALS = [
      { id: 'soft', label: 'なめらか' },
      { id: 'standard', label: '標準' },
      { id: 'light', label: '軽量' },
    ]
    const qEls = []
    QUALS.forEach((q) => {
      const chip = h('button', 'chip', q.label)
      chip.classList.toggle('chip--on', settings.quality === q.id)
      chip.addEventListener('click', () => {
        settings.quality = q.id
        qEls.forEach((e) => e.chip.classList.toggle('chip--on', e.id === q.id))
        onSettings({ quality: q.id })
        poke()
      })
      qChips.appendChild(chip)
      qEls.push({ id: q.id, chip })
    })
    qRow.appendChild(qChips)
    el.appendChild(qRow)

    // 傾きで見回す（既定オフ）
    const tiltRow = h('div', 'setrow')
    tiltRow.appendChild(h('span', 'setrow__label', '操作'))
    const tiltChips = h('div', 'axis__chips')
    const tiltBtn = h('button', 'chip', '傾きで見回す')
    tiltBtn.classList.toggle('chip--on', settings.tilt)
    tiltBtn.addEventListener('click', () => {
      settings.tilt = !settings.tilt
      tiltBtn.classList.toggle('chip--on', settings.tilt)
      onSettings({ tilt: settings.tilt })
      poke()
    })
    tiltChips.appendChild(tiltBtn)
    tiltRow.appendChild(tiltChips)
    el.appendChild(tiltRow)

    close.addEventListener('click', () => {
      el.classList.remove('panel--open')
      poke()
    })
    return { el }
  }

  function makeSlider(label, min, max, step, value, onInput) {
    const row = h('div', 'setrow')
    row.appendChild(h('span', 'setrow__label', label))
    const input = h('input', 'slider')
    input.type = 'range'
    input.min = String(min)
    input.max = String(max)
    input.step = String(step)
    input.value = String(value)
    input.addEventListener('input', () => {
      onInput(parseFloat(input.value))
      poke()
    })
    row.appendChild(input)
    return row
  }

  return {
    setSceneLabel(text) {
      sceneName.textContent = text
    },
  }
}
