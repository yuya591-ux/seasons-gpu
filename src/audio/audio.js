// 環境音のレイヤー再生。映像の作り込みに音を追いつかせるため、次を備える:
//  - 継ぎ目レスな無限ループ（同素材を末尾と先頭で重ねてクロスフェード）
//  - 情景切替のクロスフェード（master を一旦沈めて差し替え。映像の暗転と尺を合わせる）
//  - 起動時のフェードイン（静寂からそっと滲み出る）
//  - 薄いステレオ定位（レイヤーを左右へ散らし、頭の中で鳴る閉塞感を避ける）
//  - 遠雷の揺らぎ（鳴るたび音量・低域・再生速度をランダム化＝毎回違う距離の雷）
// 素材はCC0等ライセンス明確なフリー素材のみ。出典は CREDITS.md に全数記録。
// 連打切替に備え世代トークン（gen）で古い情景の読み込み・タイマー連鎖を無効化する。

export function createAudio(opts) {
  const onCue = (opts && opts.onCue) || null // 音の発火を画面に伝える（遠雷フラッシュ等）
  let ctx = null
  let master = null
  let openFilter = null // 窓のあけ具合で外音を澄ませる/こもらせるローパス（閉=ガラス越し／開=外気が澄む）
  let muffleGain = null // 窓を閉じると外音の音量も下げる防音ゲイン（ローパスだけでは虫の高域が抜けて静かにならないため）
  let windowOpenAmt = 0
  let layers = [] // ループ中のレイヤー {layerGain, stopped, panner, basePan}
  let layer_lfos = [] // swellレイヤーの満ち引きLFO（情景切替で停止する）
  let lookPan = 0 // 見回しに連動する音場の左右オフセット（右を向くと音は左へ＝視覚と一致）
  let timers = [] // ループ継ぎ足し・ランダム再生のタイマー
  let currentScene = null
  let muted = false
  let volume = 0.8
  let started = false
  let gen = 0

  const base = import.meta.env.BASE_URL || '/'
  const urlOf = (src) => base + src
  const now = () => ctx.currentTime
  const targetVol = () => (muted ? 0.0001 : Math.max(0.0001, volume))

  // iPhone/iPad は既定で Web Audio を着信音チャンネル（消音スイッチで黙る）に流す。
  // 無音の <audio> をループ再生してページの音声セッションを「再生(playback)」に保つと、
  // Web Audio がメディア音量（音量ボタン）側に乗り、マナーモードでも音量に応じて鳴る。
  const isIOS =
    /iP(hone|od|ad)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  let silentTag = null
  let silentUrl = null
  // 0.5秒の8bitモノラル無音WAVを生成（巨大なbase64を埋め込まず軽量に）。
  function makeSilentWavUrl() {
    const sr = 8000
    const n = Math.floor(sr * 0.5)
    const buf = new ArrayBuffer(44 + n)
    const v = new DataView(buf)
    const wr = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)) }
    wr(0, 'RIFF'); v.setUint32(4, 36 + n, true); wr(8, 'WAVE')
    wr(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true) // PCM
    v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr, true)
    v.setUint16(32, 1, true); v.setUint16(34, 8, true)
    wr(36, 'data'); v.setUint32(40, n, true)
    for (let i = 0; i < n; i++) v.setUint8(44 + i, 128) // 8bit無音=128
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }))
  }
  // ユーザー操作の中で呼ぶ（消音スイッチ回避の鍵＝ジェスチャ起点での再生）。
  function unlockMediaSession() {
    if (!isIOS) return
    try {
      if (!silentTag) {
        silentUrl = makeSilentWavUrl()
        silentTag = document.createElement('audio')
        silentTag.src = silentUrl
        silentTag.loop = true
        silentTag.setAttribute('playsinline', '')
        silentTag.setAttribute('webkit-playsinline', '')
        silentTag.muted = false
        silentTag.volume = 1 // 中身が無音なので可聴にはならないが「再生中」と認識させる
        // 割り込み等で止められたら自動で再生し直す（消音スイッチ回避を維持）
        const resume = () => { if (started) { const q = silentTag.play(); if (q && q.catch) q.catch(() => {}) } }
        silentTag.addEventListener('pause', resume)
        silentTag.addEventListener('ended', resume)
      }
      const p = silentTag.play()
      if (p && p.catch) p.catch(() => {})
    } catch {
      /* 無視 */
    }
  }
  // 復帰時（タブ切替・割り込み後）に音脈と無音タグを起こし直す。
  let rearmBound = false
  function bindRearm() {
    if (rearmBound) return
    rearmBound = true
    const rearm = () => {
      // 'suspended' だけでなく iOS の 'interrupted'（電話/アラーム後）も起こし直す
      if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {})
      if (started) unlockMediaSession()
    }
    // バックグラウンド（ホーム画面/他アプリ切替/タブ非表示）では音を止める。復帰したら鳴り直す。
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}) } else rearm()
    })
    window.addEventListener('pagehide', () => { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}) })
    window.addEventListener('focus', rearm)
    document.addEventListener('touchend', rearm, { passive: true })
  }

  function ensureContext() {
    if (ctx) return
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0.0001 // 無音から始めてフェードイン
    // 窓のあけ具合で外音のこもり/澄み＋音量を切り替える（master→openFilter→muffleGain→destination）。
    // 閉=ガラス越しに低くこもり音量も落ちる(防音)／開=高域まで澄んで音量も戻る。
    if (ctx.createBiquadFilter) {
      openFilter = ctx.createBiquadFilter()
      openFilter.type = 'lowpass'
      openFilter.frequency.value = windowOpenAmt > 0.5 ? 20000 : 900 // 閉=ガラス越しに大きくこもる(虫の高域も抑える)／開=澄む
      openFilter.Q.value = 0.5
      muffleGain = ctx.createGain()
      muffleGain.gain.value = windowOpenAmt > 0.5 ? 1 : 0.4 // 閉=しっかり防音で小さく／開=外気の音が戻る
      master.connect(openFilter).connect(muffleGain).connect(ctx.destination)
    } else {
      master.connect(ctx.destination)
    }
    // 割り込みで running から外れたら、復帰操作時に起こし直せるよう監視
    ctx.onstatechange = () => {
      // バックグラウンド中は起こし直さない（音を止めたまま）。前面に戻ったら rearm が再開する。
      if (started && !document.hidden && ctx && ctx.state !== 'running') ctx.resume().catch(() => {})
    }
    bindRearm()
  }

  async function loadBuffer(src) {
    try {
      const res = await fetch(urlOf(src))
      if (!res.ok) return null
      const arr = await res.arrayBuffer()
      return await ctx.decodeAudioData(arr)
    } catch {
      return null // 素材未配置・デコード不可は無音扱い
    }
  }

  // 継ぎ目レスな無限ループ: 同じ素材を末尾と先頭で xf 秒だけ重ね、クロスフェードして繋ぐ。
  // swell=true のレイヤーは、ごくゆっくり音量が膨らみ・退き・時に静まる（虫の鳴き交わしの「間」＝
  // ずっと同じ壁の違和感を消し、静かになる瞬間をつくる）。layerGainは音場/高度しぼり用に残し、別段の swellGain で揺らす。
  function startLoop(buffer, gainVal, pan, myGen, swell) {
    const dur = buffer.duration
    const xf = Math.min(0.8, dur * 0.25)
    const layerGain = ctx.createGain()
    layerGain.gain.setValueAtTime(0.0001, now())
    layerGain.gain.linearRampToValueAtTime(Math.max(0.0001, gainVal), now() + 1.4) // レイヤーのフェードイン
    // swell の揺らぎ段（layerGain → swellGain → panner/master）。素のレイヤーは layerGain を直結。
    let tail = layerGain
    if (swell && ctx.createOscillator) {
      const swellGain = ctx.createGain(); swellGain.gain.value = 0.6 // 平均を下げ、満ち引きの余地をつくる
      layerGain.connect(swellGain); tail = swellGain
      try {
        // 互いに割り切れない2つの遅いLFOを重ねて準ランダムな満ち引きに（機械的な周期に聞こえない）。
        const l1 = ctx.createOscillator(); l1.frequency.value = 0.035; const g1 = ctx.createGain(); g1.gain.value = 0.24; l1.connect(g1).connect(swellGain.gain); l1.start()
        const l2 = ctx.createOscillator(); l2.frequency.value = 0.052; const g2 = ctx.createGain(); g2.gain.value = 0.16; l2.connect(g2).connect(swellGain.gain); l2.start() // 合わせて約0.2〜1.0倍に満ち引き＝時に静まる
        layer_lfos.push(l1, l2)
      } catch { /* LFO非対応なら素の音量で鳴る */ }
    }
    let panner = null
    if (ctx.createStereoPanner) {
      panner = ctx.createStereoPanner()
      panner.pan.value = Math.max(-1, Math.min(1, pan + lookPan)) // 生成時点の見回しを反映
      tail.connect(panner).connect(master)
    } else {
      tail.connect(master)
    }
    const layer = { layerGain, stopped: false, panner, basePan: pan, baseGain: gainVal }
    layers.push(layer)

    let nextStart = now() + 0.05
    function schedule() {
      if (layer.stopped || myGen !== gen || !ctx) return
      const src = ctx.createBufferSource()
      src.buffer = buffer
      const g = ctx.createGain()
      // タブ非アクティブで setTimeout が間引かれ schedule が遅れても、過去時刻に入れない
      // （過去開始のプツッ/欠落を防ぐ）。少し先へ寄せて自己修復させる。
      const s = Math.max(nextStart, now() + 0.06)
      // 先頭で立ち上げ、末尾で落とす（重なり区間でクロスフェード）
      g.gain.setValueAtTime(0.0001, s)
      g.gain.linearRampToValueAtTime(1, s + xf)
      g.gain.setValueAtTime(1, s + dur - xf)
      g.gain.linearRampToValueAtTime(0.0001, s + dur)
      src.connect(g).connect(layerGain)
      try {
        src.start(s)
        src.stop(s + dur + 0.1)
      } catch {
        /* 競合時は無視 */
      }
      nextStart = s + dur - xf // 次は重なり分だけ早く始める
      const delay = Math.max(60, (nextStart - now() - 1.6) * 1000) // 余裕を持って先に予約（間引き耐性）
      const id = setTimeout(schedule, delay)
      timers.push(id)
    }
    schedule()
  }

  // 単発再生。遠雷(cue)は音量・低域・速度を大きく揺らし「毎回違う距離の雷」に。
  // 鳥のさえずり等(cueなし)は、低域フィルタを掛けず自然な高域を残し、ピッチもごく僅かだけ揺らす。
  function playCue(buffer, def) {
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.playbackRate.value = def.cue ? 0.9 + Math.random() * 0.25 : 0.97 + Math.random() * 0.06
    const g = ctx.createGain()
    const baseGain = def.gain != null ? def.gain : 0.5
    g.gain.value = baseGain * (def.cue ? 0.55 + Math.random() * 0.55 : 0.75 + Math.random() * 0.4)
    let node = src.connect(g)
    if (ctx.createBiquadFilter && def.cue) {
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 600 + Math.random() * 2200 // 遠いほど高域が削れる（雷の距離感）
      node = node.connect(lp)
    }
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner()
      p.pan.value = (Math.random() - 0.5) * 1.2
      node.connect(p).connect(master)
    } else {
      node.connect(master)
    }
    try {
      src.start()
    } catch {
      /* 無視 */
    }
  }

  // loop:false + interval:[min,max] の音を、ランダム間隔で繰り返し鳴らす。
  function scheduleInterval(def, buffer, myGen) {
    const [min, max] = def.interval
    const next = () => {
      if (myGen !== gen) return
      const delay = (min + Math.random() * (max - min)) * 1000
      const id = setTimeout(() => {
        if (myGen !== gen) return
        if (started && ctx) {
          // 稲光は音より先に届く: フラッシュを少し先行させてから雷鳴を鳴らす
          if (onCue && def.cue) onCue(def)
          const lead = onCue && def.cue ? 220 : 0
          setTimeout(() => {
            if (myGen === gen && started && ctx) playCue(buffer, def)
          }, lead)
        }
        next()
      }, delay)
      timers.push(id)
    }
    next()
  }

  // ループ中の全レイヤーをフェードして畳む（情景切替時）。
  function stopAllNodes() {
    if (ctx) {
      const t = now()
      layers.forEach((l) => {
        l.stopped = true
        try {
          l.layerGain.gain.cancelScheduledValues(t)
          l.layerGain.gain.setValueAtTime(l.layerGain.gain.value, t)
          l.layerGain.gain.linearRampToValueAtTime(0.0001, t + 0.3)
          setTimeout(() => {
            try {
              l.layerGain.disconnect()
            } catch {
              /* 無視 */
            }
          }, 600)
        } catch {
          /* 無視 */
        }
      })
    }
    layers = []
    layer_lfos.forEach((o) => { try { o.stop() } catch { /* 無視 */ } })
    layer_lfos = []
    timers.forEach((id) => clearTimeout(id))
    timers = []
  }

  async function playScene(scene, crossfade) {
    currentScene = scene
    if (!started || !ctx) return
    // 情景切替: master を一旦沈めてから差し替え（映像の暗転と尺を合わせる）
    if (crossfade) {
      master.gain.cancelScheduledValues(now())
      master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), now())
      master.gain.linearRampToValueAtTime(0.0001, now() + 0.25)
      await new Promise((r) => setTimeout(r, 260))
      if (!ctx) return
    }
    gen++
    const myGen = gen
    stopAllNodes()

    const loops = (scene.sounds || []).filter((d) => d.loop !== false)
    let li = 0
    for (const def of scene.sounds || []) {
      const buffer = await loadBuffer(def.src)
      if (myGen !== gen) return // 読み込み中に別情景へ切替わった→破棄
      if (!buffer) continue
      if (def.loop !== false) {
        // 薄いステレオ定位（複数レイヤーを左右へ散らす）。pan指定があれば優先。
        const pan =
          def.pan != null
            ? def.pan
            : loops.length > 1
              ? (li / Math.max(1, loops.length - 1) - 0.5) * 0.5
              : 0
        li++
        startLoop(buffer, def.gain != null ? def.gain : 1, pan, myGen, !!def.swell)
      } else if (def.interval) {
        scheduleInterval(def, buffer, myGen)
      } else {
        playCue(buffer, def)
      }
    }
    // master を戻す（起動は長く、切替は短くフェードイン）
    master.gain.cancelScheduledValues(now())
    master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), now())
    master.gain.linearRampToValueAtTime(targetVol(), now() + (crossfade ? 0.8 : 2.5))
  }

  // ── 生成的な風レイヤー（常時・素材ゼロ）。ピンクノイズ近似をゆっくり揺れるバンドパスに通し、
  // ループ素材の上にうっすら重ねて「同じ所が繰り返る」ループ感を消す（CC0原則と完全整合）。
  // master 経由なので音量/ミュート/おやすみに自動追従。値は控えめ（うっすら空気が動く程度）。
  let windNode = null
  let purrNode = null // 窓辺の猫のゴロゴロ（撫でている間だけ）
  let purrV = 0
  let flyWindV = 0 // 飛行速度に応じた風の強さ（setFlyWind）。細かな変化を無視する基準
  let altDuckV = 0 // 高度に応じた環境音のしぼり（setAltitudeDuck）。細かな変化を無視する基準
  function startWind() {
    if (!ctx || windNode || !ctx.createBiquadFilter) return
    const len = Math.floor(2 * ctx.sampleRate)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    let b0 = 0, b1 = 0, b2 = 0 // 明るめのノイズ（低音の「ぶぶぶ」を出さず、空気を切る「サー/ひゅー」寄りに）
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = 0.99 * b0 + w * 0.05; b1 = 0.96 * b1 + w * 0.08; b2 = 0.90 * b2 + w * 0.09; d[i] = (b0 * 0.3 + b1 * 0.9 + b2 * 1.25 + w * 0.16) * 0.4 }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 300; hp.Q.value = 0.5 // 低音の唸り(ぶぶぶ)を断つ
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 680; bp.Q.value = 0.85 // 風切りの芯（速度で上へ動く）
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, now()); g.gain.linearRampToValueAtTime(0.012, now() + 8)
    src.connect(hp).connect(bp).connect(g).connect(master)
    windNode = { src, g, bp, hp } // g/bp は飛行速度で風を膨らませる（setFlyWind）ために保持
    try {
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.06
      const lfoG = ctx.createGain(); lfoG.gain.value = 160; lfo.connect(lfoG).connect(bp.frequency); lfo.start() // ゆるい息づき（突風）
      const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.083
      const lfo2G = ctx.createGain(); lfo2G.gain.value = 0.01; lfo2.connect(lfo2G).connect(g.gain); lfo2.start()
    } catch { /* LFO非対応でも常時うっすらの風は鳴る */ }
    try { src.start() } catch { /* 無視 */ }
  }
  // 猫のゴロゴロ＝低めの暖色トーン＋約25Hzの震え（喉鳴り）。撫でている間だけそっと（機械音の唸りでなく猫の喉に）。
  function startPurr() {
    if (!ctx || purrNode || !ctx.createOscillator) return
    const a = ctx.createOscillator(); a.type = 'triangle'; a.frequency.value = 100
    const b = ctx.createOscillator(); b.type = 'sine'; b.frequency.value = 150
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 480; lp.Q.value = 0.4
    const pt = ctx.createGain(); pt.gain.value = 0.55                 // トレモロの土台
    const pg = ctx.createGain(); pg.gain.value = 0.0001              // 全体音量（setPurrで上下）
    a.connect(lp); b.connect(lp); lp.connect(pt).connect(pg).connect(master)
    try { const trem = ctx.createOscillator(); trem.type = 'sine'; trem.frequency.value = 25; const td = ctx.createGain(); td.gain.value = 0.45; trem.connect(td).connect(pt.gain); trem.start() } catch { /* 震え無しでも鳴る */ }
    try { a.start(); b.start() } catch { /* 無視 */ }
    purrNode = { pg }
  }

  // ── 生成的なBGMの下地（素材ゼロ・合成パッド）。CC0/オフライン原則と完全整合。
  // 【作り直しの要点（実機FB「終始ぶーぶぶぶの電子ノイズで不快」）】
  //  ・低音ドローンを廃止＝和音を中高域(165〜660Hz)へ。スマホのスピーカーは低音(80〜220Hz)を歪ませ
  //    「うなり/ぶーぶー」になる。中高域の純正弦なら柔らかいパッドとして澄んで鳴る。
  //  ・三角波をやめ全て正弦波（倍音の刺さりを排除）。ローパスも高め(柔らかいが曇らない)。
  //  ・カットオフのLFO(うねり)を廃止＝脈打つ「ワウ」感を消す。揺らぎは音量のごく微かな呼吸のみ。
  //  ・部屋では完全に無音（gain 0）＝室内は自然音だけ。空へ出てそっと滲み出る。
  // 和音は全て A マイナー・ペンタトニック（A C D E G）内＝どの場面へ移っても濁らない。
  // master 経由なので音量/ミュート/おやすみに自動追従。ピークでもごく小さく自然音を邪魔しない。
  let bedNodes = null
  const bedState = { gain: 0, cut: 1500, voice: [220, 329.6, 440] } // 今の目標値（細かな変化を無視する基準）
  // 場面ごとの和音の声部（Hz）。全て中高域の A マイナー・ペンタトニック内（低音ドローンにしない）。
  const VOICE = {
    home: [220, 329.6, 440],    // A3 E4 A4＝開いた五度。穏やかで素直な基調
    sea: [329.6, 440, 659.3],   // E4 A4 E5＝高く広い。海上の開放感
    mountain: [220, 261.6, 329.6], // A3 C4 E4＝マイナーの色。山の静けさ
    edo: [220, 293.7, 440],     // A3 D4 A4＝温かなsus。箏のような和の響き
    sengoku: [164.8, 220, 261.6], // E3 A3 C4＝やや低く翳る。戦国の張りつめた静けさ
    taisho: [261.6, 392, 523.3], // C4 G4 C5＝明るくほのかに切ない。大正の港の郷愁
  }
  function startMusicBed() {
    if (!ctx || bedNodes || !ctx.createBiquadFilter) return
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = bedState.cut; lp.Q.value = 0.3
    const bedGain = ctx.createGain(); bedGain.gain.value = 0.0001
    lp.connect(bedGain).connect(master)
    const oscs = []
    const vmix = [0.5, 0.6, 0.42] // 各声部の音量比（中声部を芯に・上声部は控えめ＝柔らかいパッド）
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator(); o.type = 'sine' // 全て正弦＝倍音の刺さりなし
      o.frequency.value = bedState.voice[i]
      o.detune.value = (i - 1) * 3 // ごく僅かなデチューン＝ゆっくりしたうねりで生命感（中高域なので濁らない）
      const og = ctx.createGain(); og.gain.value = vmix[i]
      o.connect(og).connect(lp)
      try { o.start() } catch { /* 無視 */ }
      oscs.push(o)
    }
    bedNodes = { lp, bedGain, oscs }
    // ごくゆっくりした音量の呼吸だけ（カットオフのうねりは廃止＝脈打つワウ感を出さない）。
    try {
      const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.05
      const lfo2G = ctx.createGain(); lfo2G.gain.value = 0.004; lfo2.connect(lfo2G).connect(bedGain.gain); lfo2.start() // ±0.004だけ膨らみ縮む静かな呼吸
    } catch { /* LFO非対応でも下地は鳴る */ }
  }
  // 場面（ctx）からBGMの目標（音量・音色・和音）を決め、数秒かけて滑らかに移す。
  // ctx = { off?, mode:'window'|'fly'|'walk', flyAmt, speed, altitude, terrain:'sea'|'mountain'|'land', edoP, senP, taiP, night }
  function setMusicBed(c) {
    if (!ctx || !bedNodes) return
    const t = now()
    let gain, cut, voice
    if (!c || c.off || muted) {
      gain = 0.0001; cut = bedState.cut; voice = bedState.voice // 3Dを離れる/消音中は静かに引く
    } else {
      const fly = Math.max(0, Math.min(1, c.flyAmt || 0))
      const spd = Math.max(0, Math.min(1, c.speed || 0))
      const eMax = Math.max(c.edoP || 0, c.senP || 0, c.taiP || 0)
      // 和音の選択: 時代の近さが勝てばその時代、次に地形(海/山)、なければ基調。
      if (eMax > 0.2) voice = (c.edoP >= c.senP && c.edoP >= c.taiP) ? VOICE.edo : (c.senP >= c.taiP ? VOICE.sengoku : VOICE.taisho)
      else if (c.terrain === 'sea') voice = VOICE.sea
      else if (c.terrain === 'mountain') voice = VOICE.mountain
      else voice = VOICE.home
      // 音量: 部屋＝無音(自然音だけ)。空へ出てから fly でそっと滲み出し、速度と時代の近さで僅かに満ちる。
      // 中高域は同じ振幅でも大きく聞こえる(等ラウドネス)ので、低音時代よりピークを下げる。
      if (c.mode === 'window' && fly < 0.2) gain = 0.0001 // 部屋では鳴らさない
      else if (c.mode === 'walk') gain = 0.012 * fly
      else gain = (0.013 + spd * 0.009 + eMax * 0.012) * Math.min(1, fly * 1.3)
      gain = Math.min(0.036, gain)
      // 音色（明るさ）: 海/速度で開け、山/戦国で翳り、大正は華やぎ、夜は全体に落ち着ける。高めの帯で柔らかく。
      cut = 1400 + spd * 600 + eMax * 300
      if (voice === VOICE.sea) cut += 500
      else if (voice === VOICE.mountain) cut = 1150
      else if (voice === VOICE.sengoku) cut = 1050
      else if (voice === VOICE.taisho) cut = 2200
      else if (voice === VOICE.edo) cut = 1650
      if (c.night) cut *= 0.86
    }
    // 細かな変化は無視（無駄なスケジューリングを抑える）。
    if (Math.abs(gain - bedState.gain) > 0.0012) { bedState.gain = gain; try { bedNodes.bedGain.gain.setTargetAtTime(gain, t, 1.8) } catch { /* 無視 */ } }
    if (Math.abs(cut - bedState.cut) > 24) { bedState.cut = cut; try { bedNodes.lp.frequency.setTargetAtTime(cut, t, 2.4) } catch { /* 無視 */ } }
    if (voice !== bedState.voice) {
      bedState.voice = voice
      for (let i = 0; i < 3; i++) { try { bedNodes.oscs[i].frequency.setTargetAtTime(voice[i], t, 3.6) } catch { /* 無視 */ } } // 和音はゆっくり滑らせて移す＝場面が静かに移ろう
    }
  }

  // ── イベント連動の合成音（素材ゼロ）。現実に音のある現象だけ鳴らす（花火・流れ星）。
  // 気球/飛行機雲/雲影/宵の灯り/オーロラ/虹は現実に無音なので鳴らさない。
  function boom(at, amp) {
    // 遠い花火の破裂: ノイズの胴鳴り(ローパス)＋腹に響くサブのサイン(ピッチ落ち)。光→音のずれは呼び元で付ける。
    const len = Math.floor(0.5 * ctx.sampleRate)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource(); src.buffer = buf
    const lp = ctx.createBiquadFilter ? ctx.createBiquadFilter() : null
    if (lp) { lp.type = 'lowpass'; lp.frequency.value = 380 } // 遠い＝低域中心
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(amp * 0.5, at + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.6)
    const sub = ctx.createOscillator(); sub.type = 'sine'
    sub.frequency.setValueAtTime(92, at); sub.frequency.exponentialRampToValueAtTime(44, at + 0.5)
    const sg = ctx.createGain(); sg.gain.setValueAtTime(0.0001, at); sg.gain.linearRampToValueAtTime(amp * 0.5, at + 0.02); sg.gain.exponentialRampToValueAtTime(0.0001, at + 0.55)
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null
    const out = pan || master
    if (pan) { pan.pan.value = (Math.random() - 0.5) * 0.8; pan.connect(master) }
    if (lp) { src.connect(lp); lp.connect(g) } else { src.connect(g) }
    g.connect(out); sub.connect(sg); sg.connect(out)
    try { src.start(at); src.stop(at + 0.66); sub.start(at); sub.stop(at + 0.6) } catch { /* 無視 */ }
  }
  function shimmer(at) {
    // 流れ星: ごく淡い高音のきらめき（短い下降のサイン）。
    const o = ctx.createOscillator(); o.type = 'sine'
    o.frequency.setValueAtTime(2300, at); o.frequency.exponentialRampToValueAtTime(1250, at + 0.7)
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(0.03, at + 0.06); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.8)
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null
    if (pan) { pan.pan.value = (Math.random() - 0.5); o.connect(g).connect(pan).connect(master) } else { o.connect(g).connect(master) }
    try { o.start(at); o.stop(at + 0.85) } catch { /* 無視 */ }
  }
  function playEvent(kind) {
    if (!started || !ctx || muted) return
    const T = now() + 0.02
    if (kind === 'fireworks') {
      const shots = 2 + ((Math.random() * 3) | 0)
      for (let i = 0; i < shots; i++) boom(T + 0.35 + i * (0.22 + Math.random() * 0.5), 0.5 + Math.random() * 0.34) // 光→一拍おいて遠い破裂＋連発
    } else if (kind === 'star') {
      shimmer(T)
    }
  }

  return {
    /** 最初のユーザー操作で呼ぶ。音脈を起こし、現在の情景の音を静かに立ち上げる。 */
    async start() {
      ensureContext()
      if (!ctx) return
      unlockMediaSession() // ジェスチャ起点で無音タグを再生＝iOSの消音スイッチを回避
      if (ctx.state === 'suspended') await ctx.resume()
      started = true
      startWind() // 生成的な風をそっと立ち上げる（全情景でループ感を消す）
      startMusicBed() // 生成的なBGMの下地を用意（3Dの街で場面に応じて静かに鳴る。setMusicBedが音量を上げるまでは無音）
      if (currentScene) await playScene(currentScene, false)
    },
    /** 画面の現象に音を結ぶ（花火の遠い破裂・流れ星のきらめき）。無音の現象は鳴らさない。 */
    playEvent,
    /** 3Dの街の場面（部屋/窓辺/飛び始め/巡航/速度/山/海/各時代の近さ）でBGMの下地を静かに変える。
     *  3Dを離れる時は {off:true} で静かに引く。素材ゼロの合成パッドなのでオフライン/CC0原則と整合。 */
    setMusicBed,
    /** 情景を切り替える（音もクロスフェードで差し替える）。 */
    async setScene(scene) {
      currentScene = scene
      await playScene(scene, true)
    },
    setMuted(m) {
      muted = m
      if (master) {
        master.gain.cancelScheduledValues(now())
        master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), now())
        master.gain.linearRampToValueAtTime(targetVol(), now() + 0.2)
      }
    },
    setVolume(v) {
      volume = v
      if (master && !muted) {
        master.gain.cancelScheduledValues(now())
        master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), now())
        master.gain.linearRampToValueAtTime(Math.max(0.0001, v), now() + 0.1)
      }
    },
    /** 窓のあけ具合(0..1)で外音のこもり/澄みをクロスフェード（閉=ガラス越し→開=外気が澄む）。 */
    setWindowOpen(open) {
      windowOpenAmt = open ? 1 : 0
      if (!openFilter || !ctx) return
      const f = open ? 20000 : 900 // 閉=ガラス越しに大きくこもる（虫の高域も抑える）／開=澄む
      try {
        openFilter.frequency.cancelScheduledValues(now())
        openFilter.frequency.setValueAtTime(openFilter.frequency.value, now())
        openFilter.frequency.exponentialRampToValueAtTime(f, now() + 0.9) // 窓のease(約1.15s)に寄り添う
      } catch {
        openFilter.frequency.value = f
      }
      if (muffleGain) { // 閉じると音量も落として「防音されている」手応えを出す（開けると外気の音が戻る）
        const g = open ? 1 : 0.4
        try {
          muffleGain.gain.cancelScheduledValues(now())
          muffleGain.gain.setValueAtTime(muffleGain.gain.value, now())
          muffleGain.gain.linearRampToValueAtTime(g, now() + 0.9)
        } catch {
          muffleGain.gain.value = g
        }
      }
    },
    /** 飛行速度(0..1)で風切り音を膨らませる。機械音(ブォー/ぶぶぶ)でなく、空気を切る自然な「ひゅーー」＝飛んでいると分かる風（BoTWの滑空のイメージ）。 */
    setFlyWind(v) {
      if (!windNode || !ctx) return
      v = Math.max(0, Math.min(1, v || 0))
      if (Math.abs(v - flyWindV) < 0.03) return // 細かな変化は無視（無駄なスケジューリングを抑える）
      flyWindV = v
      const t = now()
      const e = v * v // 加速の手応え＝速いほど一気に風が増す
      try {
        windNode.g.gain.setTargetAtTime(0.01 + e * 0.06, t, 0.4)         // 速いほど明確に大きく＝飛んでいる手応え
        windNode.bp.frequency.setTargetAtTime(620 + v * 1180, t, 0.4)    // 速いほど高く明るい「ひゅーー」（低い唸りにしない）
        if (windNode.hp) windNode.hp.frequency.setTargetAtTime(300 + v * 260, t, 0.4) // 速いほど低音を更に削いで澄む
      } catch { /* 無視 */ }
    },
    /** 窓辺の猫を撫でた時のゴロゴロ（0..1）。撫でているほど大きく、離すと冷める。 */
    setPurr(level) {
      if (!ctx) return
      const v = Math.max(0, Math.min(1, level || 0))
      if (Math.abs(v - purrV) < 0.03 && v > 0.001) return
      purrV = v
      if (v > 0.001 && !purrNode) startPurr()
      if (purrNode) { try { purrNode.pg.gain.setTargetAtTime(Math.max(0.0001, v * 0.045), now(), 0.18) } catch { /* 無視 */ } }
    },
    /** 散策の足音（地上を歩くときだけ・ごく控えめ）。短いこもったノイズで「踏みしめる」手応え。 */
    footstep() {
      if (!ctx) return
      const t = now()
      const len = Math.floor(0.09 * ctx.sampleRate)
      const buf = ctx.createBuffer(1, len, ctx.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2) // 短い減衰ノイズ
      const src = ctx.createBufferSource(); src.buffer = buf
      const lp = ctx.createBiquadFilter ? ctx.createBiquadFilter() : null
      const g = ctx.createGain(); g.gain.setValueAtTime(0.055, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
      if (lp) { lp.type = 'lowpass'; lp.frequency.value = 680 + Math.random() * 280; src.connect(lp).connect(g).connect(master) } // こもった足音
      else src.connect(g).connect(master)
      try { src.start(t); src.stop(t + 0.13) } catch { /* 無視 */ }
    },
    /** 街の環境音(虫/街音)をしぼる。v=しぼり量(0..1)。高空＋海上＋homeから離れた量を engine が合成して渡す。
     *  海に出ると虫の音がほぼ消える＝「海の上は風と鳥だけ」。風(生成)は別系統なので残る。 */
    setAltitudeDuck(v) {
      if (!ctx) return
      v = Math.max(0, Math.min(1, v || 0))
      if (Math.abs(v - altDuckV) < 0.03) return
      altDuckV = v
      const t = now()
      for (const l of layers) {
        if (l.stopped) continue
        try { l.layerGain.gain.setTargetAtTime(Math.max(0.0001, (l.baseGain || 0.4) * (1 - v * 0.92)), t, 0.5) } catch { /* 無視 */ } // 海上ではほぼ無音まで
      }
    },
    /** 鳥が驚いて飛び立つ羽音（近づくと数回の柔らかい羽ばたき）。ごく控えめに。 */
    birdFlush() {
      if (!ctx) return
      const t0 = now()
      for (let f = 0; f < 3; f++) { // 数回の羽ばたき
        const at = t0 + f * 0.085 + Math.random() * 0.02
        const len = Math.floor(0.05 * ctx.sampleRate)
        const buf = ctx.createBuffer(1, len, ctx.sampleRate); const d = buf.getChannelData(0)
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.5)
        const src = ctx.createBufferSource(); src.buffer = buf
        const bp = ctx.createBiquadFilter ? ctx.createBiquadFilter() : null
        const g = ctx.createGain(); g.gain.setValueAtTime(0.04, at); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.07)
        if (bp) { bp.type = 'bandpass'; bp.frequency.value = 900 + Math.random() * 500; bp.Q.value = 0.6; src.connect(bp).connect(g).connect(master) }
        else src.connect(g).connect(master)
        try { src.start(at); src.stop(at + 0.08) } catch { /* 無視 */ }
      }
    },
    /** 海鳥(かもめ)の遠い鳴き声。海の上で時々＝海らしさと、長い渡りの退屈しのぎ。数声の下降する笛のような声。 */
    seaBird() {
      if (!ctx || muted) return
      const t0 = now() + 0.02, cries = 1 + ((Math.random() * 2) | 0)
      for (let c = 0; c < cries; c++) {
        const at = t0 + c * (0.22 + Math.random() * 0.18), f0 = 850 + Math.random() * 520
        const o = ctx.createOscillator(); o.type = 'sawtooth'
        o.frequency.setValueAtTime(f0, at); o.frequency.linearRampToValueAtTime(f0 * 0.62, at + 0.18 + Math.random() * 0.1) // 下降する鳴き
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(0.045, at + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.32)
        let node = o
        if (ctx.createBiquadFilter) { const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 1.1; node = o.connect(bp) } // 笛らしく
        if (ctx.createStereoPanner) { const pan = ctx.createStereoPanner(); pan.pan.value = (Math.random() - 0.5) * 1.3; node.connect(g).connect(pan).connect(master) } else node.connect(g).connect(master)
        try { o.start(at); o.stop(at + 0.38) } catch { /* 無視 */ }
      }
    },
    /** 見回しの角度(yaw)で音場を左右に動かす（右を向くと音は左へ＝視覚と一致）。聴覚にも窓の外の広がりを。 */
    setLookPan(yaw) {
      lookPan = Math.max(-0.45, Math.min(0.45, -(yaw || 0) * 0.16))
      if (!ctx) return
      const t = now()
      for (const l of layers) {
        if (!l.panner || l.stopped) continue
        const target = Math.max(-1, Math.min(1, l.basePan + lookPan))
        try { l.panner.pan.setTargetAtTime(target, t, 0.12) } catch { l.panner.pan.value = target } // なめらかに移す（クリック音を避ける）
      }
    },
    getLookPan() { return lookPan }, // 検証/連携用
    getDebug() { return { state: ctx ? ctx.state : 'none', bedReady: !!bedNodes, bedGain: bedState.gain, bedCut: bedState.cut, bedVoice: bedState.voice.join('/') } }, // 検証用: BGM下地の状態
    isStarted() {
      return started
    },
  }
}
