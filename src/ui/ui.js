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
    onToggleFly, // (fly) => void  空へ飛び立つ/窓へもどる（立体の街）
    onToggleLand, // (land) => void  飛び降りて着地して歩く/また飛び立つ（立体の街）
    isFlyable, // () => boolean  いま「空へ/おりる」を出してよいか（立体の街のとき）
    onSleepTimer, // (minutes) => void  おやすみタイマー（0=なし）
    getJournal, // () => journal  通い帳の記録（訪れた窓辺・累計時間・まれな現象）
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
  vol.setAttribute('aria-label', '音量')
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
  const flyBtn = h('button', 'iconbtn iconbtn--fly', '空へ')       // 上下の移動: 空へ／おりる
  const backBtn = h('button', 'iconbtn iconbtn--back', '窓辺へもどる') // 窓辺へ戻る（空/地上にいる時だけ）
  topbar.insertBefore(leanBtn, sceneBtn)
  topbar.insertBefore(windowBtn, leanBtn)
  topbar.insertBefore(flyBtn, sceneBtn)  // 乗り出すの先に「空へ」（立体の街でだけ出す）
  topbar.insertBefore(backBtn, sceneBtn) // その先に「窓辺へもどる」
  let windowIsOpen = false
  let leanIsOut = false
  let aloft = null // null=窓辺 / 'fly'=空を飛ぶ / 'walk'=地上を歩く
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
    const canFly = !!(isFlyable && isFlyable())
    const isAloft = aloft === 'fly' || aloft === 'walk'
    // 空/地上にいる間は窓・乗り出しの操作は意味がないので隠す。
    windowBtn.style.display = show && !isAloft ? '' : 'none'
    // 乗り出すは屋上以外の窓辺の情景で（枠が消えて景色だけを見渡す）
    leanBtn.style.display = show && !isRoof() && !isAloft ? '' : 'none'
    // 「空へ」は立体の街で乗り出した先に出す。飛行中は「おりる」、歩行中は「空へ」（また飛び立つ）。
    flyBtn.style.display = (canFly && (leanIsOut || isAloft)) ? '' : 'none'
    backBtn.style.display = (canFly && isAloft) ? '' : 'none' // 窓辺へもどるは空/地上にいる時だけ
    if (!show) {
      if (windowIsOpen) { windowIsOpen = false; onToggleWindow && onToggleWindow(false) }
      if (leanIsOut) { leanIsOut = false; onToggleLean && onToggleLean(false) }
    }
    if (!canFly && isAloft) { aloft = null; onToggleFly && onToggleFly(false) } // 情景が変わったら畳む
    windowBtn.textContent = windowLabel()
    windowBtn.classList.toggle('is-open', windowIsOpen)
    leanBtn.textContent = leanIsOut ? 'もどる' : '乗り出す'
    leanBtn.classList.toggle('is-open', leanIsOut)
    // 飛行中＝下りる導線「おりる」、それ以外（窓辺/歩行）＝上がる導線「空へ」
    flyBtn.textContent = aloft === 'fly' ? 'おりる' : '空へ'
    flyBtn.classList.toggle('is-open', isAloft)
  }
  // 空/地上へ出た時に一度だけ、そっと操作を伝える。静かな文言・数秒で消える。
  const walkHint = h('div', 'walk-hint', '画面をドラッグして飛ぶ　上=上昇 下=下降 左右=旋回　「とまる」で停止')
  root.appendChild(walkHint)
  let walkHintShown = false
  let walkHintTimer = null
  function showWalkHint() {
    if (walkHintShown) return
    walkHintShown = true
    walkHint.classList.add('walk-hint--on')
    clearTimeout(walkHintTimer)
    walkHintTimer = setTimeout(() => walkHint.classList.remove('walk-hint--on'), 5000)
  }
  function stopAloft() {
    if (aloft) { aloft = null; onToggleFly && onToggleFly(false) } // 空/地上から窓辺へ戻す
  }
  windowBtn.addEventListener('click', () => {
    windowIsOpen = !windowIsOpen
    onToggleWindow && onToggleWindow(windowIsOpen)
    if (!windowIsOpen && leanIsOut) { leanIsOut = false; onToggleLean && onToggleLean(false) } // 閉じたら乗り出しも戻す
    if (!windowIsOpen) stopAloft() // 窓を閉じたら空/地上からも戻る
    updateWindowBtn()
    poke()
  })
  leanBtn.addEventListener('click', () => {
    leanIsOut = !leanIsOut
    onToggleLean && onToggleLean(leanIsOut)
    if (leanIsOut) windowIsOpen = true // 乗り出すには開ける
    else stopAloft() // 乗り出しを戻したら空/地上からも戻る
    updateWindowBtn()
    poke()
  })
  flyBtn.addEventListener('click', () => {
    // 窓辺→空へ / 飛行→おりて歩く / 歩行→また空へ（上下の移動を1つのボタンで段階的に）
    if (aloft === 'fly') { aloft = 'walk'; onToggleLand && onToggleLand(true) }
    else if (aloft === 'walk') { aloft = 'fly'; onToggleLand && onToggleLand(false) }
    else { aloft = 'fly'; windowIsOpen = true; leanIsOut = true; onToggleFly && onToggleFly(true); showWalkHint() } // 飛ぶには窓をあけ乗り出した状態から。初回だけ操作を案内
    updateWindowBtn()
    poke()
  })
  backBtn.addEventListener('click', () => {
    stopAloft()
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

  // ── 通い帳パネル（訪れた窓辺・過ごした時間・立ち会ったまれな現象） ──
  const panelJournal = buildJournalPanel()
  root.appendChild(panelJournal.el)

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

  // ── 通い帳パネル：訪れた窓辺・過ごした時間・立ち会ったまれな現象を静かに振り返る（達成でなく記録） ──
  function buildJournalPanel() {
    const el = h('div', 'panel panel--journal')
    const head = h('div', 'panel__head')
    head.appendChild(h('h2', 'panel__title', '通い帳'))
    const close = h('button', 'iconbtn', '×')
    close.setAttribute('aria-label', '閉じる')
    head.appendChild(close)
    el.appendChild(head)
    const bodyEl = h('div', 'journal')
    el.appendChild(bodyEl)
    close.addEventListener('click', () => { el.classList.remove('panel--open'); poke() })
    const BASE = import.meta.env.BASE_URL || '/'
    const fmtDur = (sec) => {
      const m = Math.floor((sec || 0) / 60)
      if (m < 60) return `${m}分`
      const hh = Math.floor(m / 60); const mm = m % 60
      return mm ? `${hh}時間${mm}分` : `${hh}時間`
    }
    function render() {
      bodyEl.replaceChildren()
      const j = (getJournal && getJournal()) || { visits: {}, seconds: 0, events: {}, firstAt: null }
      const visitIds = Object.keys(j.visits || {}).filter((id) => SCENES.some((s) => s.id === id))
      const lead = h('p', 'journal__lead')
      if (!j.firstAt || !visitIds.length) {
        lead.textContent = 'まだ記録がありません。窓辺に座ると、静かに溜まっていきます。'
      } else {
        const days = Math.max(1, Math.round((Date.now() - j.firstAt) / 86400000))
        lead.textContent = `はじめての窓辺から ${days}日。これまでに ${fmtDur(j.seconds)}、眺めました。`
      }
      bodyEl.appendChild(lead)
      if (visitIds.length) {
        visitIds.sort((a, b) => j.visits[b] - j.visits[a]) // 多く座った窓辺から
        const grid = h('div', 'journal__grid')
        for (const id of visitIds) {
          const sc = SCENES.find((s) => s.id === id)
          const cell = h('div', 'journal__cell')
          const sw = h('span', 'journal__thumb')
          const pal = sc.palette.early
          sw.style.backgroundImage = `url("${BASE}thumbs/${id}.jpg"), linear-gradient(165deg, ${pal.skyTop}, ${pal.horizon})`
          cell.appendChild(sw)
          cell.appendChild(h('span', 'journal__name', sc.label))
          grid.appendChild(cell)
        }
        bodyEl.appendChild(grid)
      }
      const ev = j.events || {}
      const seen = [['rainbow', '虹'], ['star', '流れ星'], ['fireworks', '花火'], ['aurora', 'オーロラ']]
        .filter(([k]) => ev[k] > 0).map(([k, n]) => `${n}に${ev[k]}度`)
      if (seen.length) bodyEl.appendChild(h('p', 'journal__events', '立ち会った景色　' + seen.join('、')))
    }
    return {
      el,
      open() { render(); el.classList.add('panel--open'); requestAnimationFrame(() => close.focus()) },
    }
  }

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

    // 季節で絞り込むフィルタ（30以上の情景から「選ぶ」を助ける。器=scene.axes.season）。
    const filterBar = h('div', 'gallery-filter')
    const SEASONS = [['all', 'すべて'], ['spring', '春'], ['summer', '夏'], ['autumn', '秋'], ['winter', '冬']]
    let activeSeason = 'all'
    const filterChips = []
    for (const [key, jlabel] of SEASONS) {
      const chip = h('button', 'chip', jlabel)
      if (key === 'all') chip.classList.add('chip--on')
      chip.addEventListener('click', () => {
        activeSeason = key
        filterChips.forEach((c) => c.el.classList.toggle('chip--on', c.key === key))
        applyFilter()
        poke()
      })
      filterChips.push({ key, el: chip })
      filterBar.appendChild(chip)
    }
    el.appendChild(filterBar)

    const gallery = h('div', 'gallery')
    el.appendChild(gallery)

    const cards = []
    const headings = []
    // 公開する情景だけ（実証/開発用は public:false で隠す）
    const devMode = /[?&]dev=1/.test(location.search)
    const BASE = import.meta.env.BASE_URL || '/'
    const pubScenes = SCENES.filter((s) => s.status === 'ready' && (s.public !== false || devMode))
    function makeCard(scene) {
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
      cards.push({ id: scene.id, card, season: (scene.axes && scene.axes.season) || '' })
    }
    // シリーズ見出しで一覧の見通しを良くする（情景が増えても探しやすい）。見出しはグリッド全幅に渡る。
    const groups = [
      ['実写の窓', (s) => s.render === 'photoWindow'],
      ['立体の街と谷戸', (s) => s.render === 'town3d' && s.town3dKind !== 'corner'],
      ['角部屋から', (s) => s.render === 'town3d' && s.town3dKind === 'corner'], // 角部屋も立体の街エンジンへ載せ替え済み

      ['街と自然', () => true], // 残り全部（下町・雨・海・山・屋上・デモ）
    ]
    const placed = new Set()
    for (const [name, test] of groups) {
      const inGroup = pubScenes.filter((s) => !placed.has(s.id) && test(s))
      if (!inGroup.length) continue
      const hEl = h('h3', 'gallery__group', name)
      gallery.appendChild(hEl)
      const ids = []
      for (const scene of inGroup) { placed.add(scene.id); makeCard(scene); ids.push(scene.id) }
      headings.push({ el: hEl, ids })
    }
    // 季節フィルタの適用: 一致しないカードと、表示カードが無くなった見出しを隠す。
    function applyFilter() {
      cards.forEach(({ card, season }) => {
        card.style.display = activeSeason === 'all' || season === activeSeason ? '' : 'none'
      })
      headings.forEach(({ el: hEl, ids }) => {
        const anyVisible = activeSeason === 'all' || ids.some((id) => {
          const c = cards.find((cc) => cc.id === id)
          return c && c.season === activeSeason
        })
        hEl.style.display = anyVisible ? '' : 'none'
      })
    }

    function markCurrent() {
      cards.forEach(({ id, card }) => {
        const on = id === currentScene.id
        card.classList.toggle('scene-card--on', on)
        card.setAttribute('aria-pressed', String(on)) // 選択中を支援技術へ（評価 a11y）
      })
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
    // 時間をとどめる（既定オフ＝ゆっくり日が移ろう。オンで今の時刻に静止）
    const stayBtn = h('button', 'chip', '時間をとどめる')
    stayBtn.classList.toggle('chip--on', settings.timeStay)
    stayBtn.addEventListener('click', () => {
      settings.timeStay = !settings.timeStay
      stayBtn.classList.toggle('chip--on', settings.timeStay)
      onSettings({ timeStay: settings.timeStay })
      poke()
    })
    tiltChips.appendChild(stayBtn)
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

    // 通い帳：訪れた窓辺・過ごした時間・立ち会ったまれな現象を静かに振り返る
    const journalRow = h('div', 'setrow')
    journalRow.appendChild(h('span', 'setrow__label', '記録'))
    const journalChips = h('div', 'axis__chips')
    const journalBtn = h('button', 'chip', '通い帳をひらく')
    journalBtn.addEventListener('click', () => {
      el.classList.remove('panel--open') // 設定を閉じて通い帳へ
      panelJournal.open()
      poke()
    })
    journalChips.appendChild(journalBtn)
    journalRow.appendChild(journalChips)
    el.appendChild(journalRow)

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
    input.setAttribute('aria-label', label) // 支援技術向けのラベル（評価 a11y）
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
      aloft = null // 空/地上からも畳む（情景切替で残らない）
      updateWindowBtn()
    },
  }
}
