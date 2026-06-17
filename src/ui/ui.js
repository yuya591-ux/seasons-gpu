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
    onToggleLean, // (lean) => void  身を乗り出す/もどる
    onSleepTimer, // (minutes) => void  おやすみタイマー（0=なし）
  } = opts

  const root = h('div', 'ui')
  document.body.appendChild(root)
  // 起動前は HUD/右上ボタンを隠す（半透明のゲート越しにUIが透けて散らかるのを防ぐ＝評価UX・静かな入口）。
  document.body.classList.add('pre-start')

  let currentScene = initialScene
  let intensityLabelEl = null // 設定の「強さ」スライダーの名前（情景で変わる）
  let intensityRowEl = null // 「強さ」行（town3d等では効かないので隠す＝評価UX-H4）
  // 「強さ」が効くのはシェーダー情景（雨脚・陽炎・雲など uIntensity を使う）。3Dの街/谷戸では無効→隠す。
  const intensityApplies = (s) => s && s.render !== 'town3d'
  function syncIntensityRow() {
    if (intensityRowEl) intensityRowEl.style.display = intensityApplies(currentScene) ? '' : 'none'
  }

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
    document.body.classList.remove('pre-start') // 開始でHUD/ボタンが静かに現れる
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
  const LOOKABLE = ['cornerRoom', 'windowTown', 'windowMountains', 'windowSea', 'windowPano', 'town3d', 'photoWindow']
  // 初回のみ: 「見回せる」ことをそっと伝える（localStorageで2回目以降は出さない）
  function maybeShowLookHint() {
    if (!LOOKABLE.includes(currentScene.render)) return // 見回せない情景では出さない
    try {
      if (localStorage.getItem('seasons_look_hint')) return
    } catch {
      /* localStorage不可でも続行 */
    }
    const hint = h('div', 'lookhint', '指でなぞって見渡す　／　窓をあける')
    root.appendChild(hint)
    requestAnimationFrame(() => hint.classList.add('lookhint--show'))
    const dismiss = () => {
      hint.classList.remove('lookhint--show')
      setTimeout(() => hint.remove(), 1400)
    }
    const timer = setTimeout(dismiss, 4600)
    // パネルを開く等で触れたら、ヒントはそっと消す（ギャラリーに被らない＝評価UX）。
    window.addEventListener('pointerdown', () => { clearTimeout(timer); dismiss() }, { once: true, passive: true })
    try {
      localStorage.setItem('seasons_look_hint', '1')
    } catch {
      /* 無視 */
    }
  }

  // ── HUD（情景名・音） ──
  const hud = h('div', 'hud')
  const sceneName = h('p', 'hud__scene', currentScene.label)
  sceneName.setAttribute('aria-live', 'polite') // 情景の切替を支援技術へ伝える
  sceneName.setAttribute('role', 'status')
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

  // ── 窓をあける/しめる＋身を乗り出す（窓辺の情景でだけ） ──
  const WINDOW_SCENES = ['cornerRoom', 'windowTown', 'shishigaya', 'windowSea', 'windowMountains', 'kitateraoRooftop', 'town3d', 'photoWindow']
  const windowBtn = h('button', 'iconbtn iconbtn--window', '窓をあける')
  const leanBtn = h('button', 'iconbtn iconbtn--lean', '乗り出す')
  topbar.insertBefore(leanBtn, sceneBtn)
  topbar.insertBefore(windowBtn, leanBtn)
  let windowIsOpen = false
  let leanIsOut = false
  function isRoof() {
    return currentScene.render === 'kitateraoRooftop'
  }
  function windowLabel() {
    // 屋上（開けた眺め）は「かすみを払う」、窓辺は「窓をあける」
    if (isRoof()) return windowIsOpen ? 'かすみへ戻す' : 'かすみを払う'
    return windowIsOpen ? '窓をしめる' : '窓をあける'
  }
  function updateWindowBtn() {
    const show = WINDOW_SCENES.includes(currentScene.render)
    windowBtn.style.display = show ? '' : 'none'
    // 乗り出すは屋上以外の窓辺の情景で（枠が消えて景色だけを見渡す）
    leanBtn.style.display = show && !isRoof() ? '' : 'none'
    if (!show) {
      if (windowIsOpen) { windowIsOpen = false; onToggleWindow && onToggleWindow(false) }
      if (leanIsOut) { leanIsOut = false; onToggleLean && onToggleLean(false) }
    }
    windowBtn.textContent = windowLabel()
    windowBtn.classList.toggle('is-open', windowIsOpen)
    leanBtn.textContent = leanIsOut ? 'もどる' : '乗り出す'
    leanBtn.classList.toggle('is-open', leanIsOut)
  }
  windowBtn.addEventListener('click', () => {
    windowIsOpen = !windowIsOpen
    onToggleWindow && onToggleWindow(windowIsOpen)
    if (!windowIsOpen && leanIsOut) { leanIsOut = false; onToggleLean && onToggleLean(false) } // 閉じたら乗り出しも戻す
    updateWindowBtn()
    poke()
  })
  leanBtn.addEventListener('click', () => {
    leanIsOut = !leanIsOut
    onToggleLean && onToggleLean(leanIsOut)
    if (leanIsOut) windowIsOpen = true // 乗り出すには開ける
    updateWindowBtn()
    poke()
  })
  updateWindowBtn() // 初期表示（窓辺・屋上の情景でだけ出す）

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
    const c = panelSet.el.querySelector('.panel__head .iconbtn')
    if (c) requestAnimationFrame(() => c.focus()) // 開いたらパネル内へフォーカス（キーボード操作）
    poke()
  })

  // Escape でどのパネルも閉じる（キーボード・支援技術への配慮）
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return
    let closed = false
    ;[panelScene.el, panelSet.el].forEach((p) => {
      if (p.classList.contains('panel--open')) {
        p.classList.remove('panel--open')
        closed = true
      }
    })
    if (closed) poke()
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
        syncIntensityRow() // 情景に応じて「強さ」行を出し分け
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
        requestAnimationFrame(() => close.focus()) // 開いたらパネル内へフォーカス
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
    intensityRowEl = intensityRow
    el.appendChild(intensityRow)
    el.appendChild(
      makeSlider('明るさ', 0.7, 1.3, 0.01, settings.brightness, (v) => {
        settings.brightness = v
        onSettings({ brightness: v })
      }, true), // 中央=標準のティックを出す（向きの目安＝評価UX-H4）
    )
    syncIntensityRow() // 起動情景に応じて「強さ」行の出し分け

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
    // 全画面（対応ブラウザのみ。没入のため画面いっぱいに）
    if (document.fullscreenEnabled) {
      const fsBtn = h('button', 'chip', '全画面')
      const syncFs = () => fsBtn.classList.toggle('chip--on', !!document.fullscreenElement)
      fsBtn.addEventListener('click', () => {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
        else document.documentElement.requestFullscreen().catch(() => {})
        poke()
      })
      document.addEventListener('fullscreenchange', syncFs)
      tiltChips.appendChild(fsBtn)
    }
    tiltRow.appendChild(tiltChips)
    el.appendChild(tiltRow)

    // おやすみタイマー：眺めているうちに、そっと暗くなって休む
    const sleepRow = h('div', 'setrow')
    sleepRow.appendChild(h('span', 'setrow__label', 'おやすみ'))
    const sleepChips = h('div', 'axis__chips')
    const SLEEPS = [
      { m: 0, label: 'なし' },
      { m: 15, label: '15分' },
      { m: 30, label: '30分' },
      { m: 60, label: '60分' },
    ]
    const sEls = []
    SLEEPS.forEach((s) => {
      const chip = h('button', 'chip', s.label)
      chip.classList.toggle('chip--on', (settings.sleep || 0) === s.m)
      chip.addEventListener('click', () => {
        settings.sleep = s.m
        sEls.forEach((e) => e.chip.classList.toggle('chip--on', e.m === s.m))
        onSleepTimer && onSleepTimer(s.m)
        poke()
      })
      sleepChips.appendChild(chip)
      sEls.push({ m: s.m, chip })
    })
    sleepRow.appendChild(sleepChips)
    el.appendChild(sleepRow)

    close.addEventListener('click', () => {
      el.classList.remove('panel--open')
      poke()
    })
    return { el }
  }

  function makeSlider(label, min, max, step, value, onInput, centered) {
    const row = h('div', 'setrow')
    row.appendChild(h('span', 'setrow__label', label))
    const input = h('input', centered ? 'slider slider--centered' : 'slider')
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
    // 情景を替えたら窓は閉じた状態から（ボタン表示と描画のズレを防ぐ）。通知はしない。
    resetWindow() {
      windowIsOpen = false
      leanIsOut = false
      updateWindowBtn()
    },
  }
}
