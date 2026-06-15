// 画面のUI。眺める邪魔をしないよう最小限・控えめ。無操作でHUDは静かに消える。
// 文言は静かで上質に。システム用語は出さない。

import { SCENES, pickNowScene } from '../data/scenes/index.js'

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
    onToggleWindow, // (open) => void  窓をあける/しめる
  } = opts

  const root = h('div', 'ui')
  document.body.appendChild(root)

  let currentScene = initialScene
  let intensityLabelEl = null // 設定の「強さ」スライダーの名前（情景で変わる）

  // ── 起動ゲート（iOS自動再生対策） ──
  const gate = h('div', 'gate')
  // キーボード・支援技術でも始められるように、ボタンとして振る舞わせる
  gate.setAttribute('role', 'button')
  gate.setAttribute('tabindex', '0')
  gate.setAttribute('aria-label', '眺めて、整う。画面にふれて始める')
  gate.appendChild(h('p', 'gate__title', '眺めて、整う'))
  gate.appendChild(h('p', 'gate__lead', '画面にふれて始める'))
  root.appendChild(gate)
  let gateStarted = false
  async function startExperience() {
    if (gateStarted) return
    gateStarted = true
    gate.classList.add('gate--hide')
    setTimeout(() => gate.remove(), 800)
    try {
      await onAudioStart()
    } catch {
      /* 音が出せなくても体験は続行 */
    }
    poke()
    maybeShowLookHint()
  }
  gate.addEventListener('click', startExperience)
  gate.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault()
      startExperience()
    }
  })
  // 起動時に入口へフォーカス（キーボードでそのまま開始できる）
  requestAnimationFrame(() => gate.focus())

  // 見回せる情景（窓辺シリーズ）だけでヒントを出す
  const LOOKABLE = ['cornerRoom', 'windowTown', 'windowMountains', 'windowSea', 'windowPano']
  // 初回のみ: 「見回せる」ことをそっと伝える（localStorageで2回目以降は出さない）
  function maybeShowLookHint() {
    if (!LOOKABLE.includes(currentScene.render)) return // 見回せない情景では出さない
    try {
      if (localStorage.getItem('seasons_look_hint')) return
    } catch {
      /* localStorage不可でも続行 */
    }
    const hint = h('div', 'lookhint', '指でなぞって、見回す')
    root.appendChild(hint)
    requestAnimationFrame(() => hint.classList.add('lookhint--show'))
    setTimeout(() => {
      hint.classList.remove('lookhint--show')
      setTimeout(() => hint.remove(), 1400)
    }, 4200)
    try {
      localStorage.setItem('seasons_look_hint', '1')
    } catch {
      /* 無視 */
    }
  }

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

  // ── 窓をあける/しめる（窓辺の情景でだけ。開けると素通しの澄んだ景色＋そよ風） ──
  const WINDOW_SCENES = ['cornerRoom', 'windowTown', 'shishigaya']
  const windowBtn = h('button', 'iconbtn iconbtn--window', '窓をあける')
  topbar.insertBefore(windowBtn, sceneBtn)
  let windowIsOpen = false
  function updateWindowBtn() {
    const show = WINDOW_SCENES.includes(currentScene.render)
    windowBtn.style.display = show ? '' : 'none'
    if (!show && windowIsOpen) {
      windowIsOpen = false
      onToggleWindow && onToggleWindow(false)
    }
    windowBtn.textContent = windowIsOpen ? '窓をしめる' : '窓をあける'
  }
  windowBtn.addEventListener('click', () => {
    windowIsOpen = !windowIsOpen
    onToggleWindow && onToggleWindow(windowIsOpen)
    windowBtn.textContent = windowIsOpen ? '窓をしめる' : '窓をあける'
    poke()
  })
  updateWindowBtn() // 初期表示（窓辺の情景でだけ出す）

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

  // ── 情景パネル：実装済みの情景をカード一覧で直接選ぶ ──
  function buildScenePanel() {
    const el = h('div', 'panel panel--scene')
    const head = h('div', 'panel__head')
    head.appendChild(h('h2', 'panel__title', '情景を選ぶ'))
    const nowBtn = h('button', 'iconbtn nowbtn', 'いま')
    nowBtn.setAttribute('aria-label', '今の季節と時刻に合う窓辺')
    head.appendChild(nowBtn)
    const close = h('button', 'iconbtn', '×')
    close.setAttribute('aria-label', '閉じる')
    head.appendChild(close)
    el.appendChild(head)

    const gallery = h('div', 'gallery')
    el.appendChild(gallery)

    const cards = []
    // 公開する情景だけ（実証/開発用は public:false で隠す）
    const devMode = /[?&]dev=1/.test(location.search)
    const BASE = import.meta.env.BASE_URL || '/'
    SCENES.filter((s) => s.status === 'ready' && (s.public !== false || devMode)).forEach((scene) => {
      const card = h('button', 'scene-card')
      // 実描画のサムネ（読み込めない時はパレットのグラデへフォールバック）
      const sw = h('span', 'scene-card__swatch')
      const pal = scene.palette.early
      const grad = `linear-gradient(165deg, ${pal.skyTop}, ${pal.skyMid} 55%, ${pal.horizon})`
      sw.style.backgroundImage = `url("${BASE}thumbs/${scene.id}.jpg"), ${grad}`
      const body = h('span', 'scene-card__body')
      body.appendChild(h('span', 'scene-card__label', scene.label))
      body.appendChild(h('span', 'scene-card__desc', scene.desc || ''))
      card.appendChild(sw)
      card.appendChild(body)
      card.addEventListener('click', () => selectScene(scene))
      gallery.appendChild(card)
      cards.push({ id: scene.id, card })
    })

    function markCurrent() {
      cards.forEach(({ id, card }) => card.classList.toggle('scene-card--on', id === currentScene.id))
    }

    function selectScene(scene) {
      if (scene && scene.id !== currentScene.id) {
        currentScene = scene
        sceneName.textContent = scene.label
        if (intensityLabelEl) intensityLabelEl.textContent = scene.intensityLabel || '強さ'
        onApplyScene(scene)
        markCurrent()
        updateWindowBtn()
      }
      el.classList.remove('panel--open')
      poke()
    }

    nowBtn.addEventListener('click', () => selectScene(pickNowScene()))

    close.addEventListener('click', () => {
      el.classList.remove('panel--open')
      poke()
    })

    return {
      el,
      open() {
        markCurrent()
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
    qRow.appendChild(h('span', 'setrow__label', '描き込み'))
    const qChips = h('div', 'axis__chips')
    const QUALS = [
      { id: 'soft', label: 'こまやか' },
      { id: 'standard', label: 'ふつう' },
      { id: 'light', label: '軽やか' },
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
