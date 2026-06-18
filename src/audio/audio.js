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
  let windowOpenAmt = 0
  let layers = [] // ループ中のレイヤー {layerGain, stopped, panner, basePan}
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
    document.addEventListener('visibilitychange', () => { if (!document.hidden) rearm() })
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
    // 窓のあけ具合で外音のこもり/澄みを切り替えるローパス（master→openFilter→destination）。
    if (ctx.createBiquadFilter) {
      openFilter = ctx.createBiquadFilter()
      openFilter.type = 'lowpass'
      openFilter.frequency.value = windowOpenAmt > 0.5 ? 20000 : 5200 // 閉=ガラス越しのこもり／開=澄む
      openFilter.Q.value = 0.6
      master.connect(openFilter).connect(ctx.destination)
    } else {
      master.connect(ctx.destination)
    }
    // 割り込みで running から外れたら、復帰操作時に起こし直せるよう監視
    ctx.onstatechange = () => {
      if (started && ctx && ctx.state !== 'running') ctx.resume().catch(() => {})
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
  function startLoop(buffer, gainVal, pan, myGen) {
    const dur = buffer.duration
    const xf = Math.min(0.8, dur * 0.25)
    const layerGain = ctx.createGain()
    layerGain.gain.setValueAtTime(0.0001, now())
    layerGain.gain.linearRampToValueAtTime(Math.max(0.0001, gainVal), now() + 1.4) // レイヤーのフェードイン
    let panner = null
    if (ctx.createStereoPanner) {
      panner = ctx.createStereoPanner()
      panner.pan.value = Math.max(-1, Math.min(1, pan + lookPan)) // 生成時点の見回しを反映
      layerGain.connect(panner).connect(master)
    } else {
      layerGain.connect(master)
    }
    const layer = { layerGain, stopped: false, panner, basePan: pan }
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
        startLoop(buffer, def.gain != null ? def.gain : 1, pan, myGen)
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
  let flyWindV = 0 // 飛行速度に応じた風の強さ（setFlyWind）。細かな変化を無視する基準
  function startWind() {
    if (!ctx || windNode || !ctx.createBiquadFilter) return
    const len = Math.floor(2 * ctx.sampleRate)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    let b0 = 0, b1 = 0, b2 = 0 // ピンクノイズ近似（Paul Kellet 風の簡易版）
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = 0.99 * b0 + w * 0.05; b1 = 0.96 * b1 + w * 0.08; b2 = 0.90 * b2 + w * 0.09; d[i] = (b0 + b1 + b2) * 0.45 }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.7
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, now()); g.gain.linearRampToValueAtTime(0.022, now() + 8)
    src.connect(bp).connect(g).connect(master)
    windNode = { src, g, bp } // g/bp は飛行速度で風を膨らませる（setFlyWind）ために保持
    try {
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05
      const lfoG = ctx.createGain(); lfoG.gain.value = 180; lfo.connect(lfoG).connect(bp.frequency); lfo.start()
      const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.073
      const lfo2G = ctx.createGain(); lfo2G.gain.value = 0.012; lfo2.connect(lfo2G).connect(g.gain); lfo2.start()
    } catch { /* LFO非対応でも常時うっすらの風は鳴る */ }
    try { src.start() } catch { /* 無視 */ }
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
      if (currentScene) await playScene(currentScene, false)
    },
    /** 画面の現象に音を結ぶ（花火の遠い破裂・流れ星のきらめき）。無音の現象は鳴らさない。 */
    playEvent,
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
      const f = open ? 20000 : 5200
      try {
        openFilter.frequency.cancelScheduledValues(now())
        openFilter.frequency.setValueAtTime(openFilter.frequency.value, now())
        openFilter.frequency.exponentialRampToValueAtTime(f, now() + 0.9) // 窓のease(約1.15s)に寄り添う
      } catch {
        openFilter.frequency.value = f
      }
    },
    /** 飛行速度(0..1)で風を膨らませる（速いほど風切りが強まり高くなる＝飛んでいる手応え）。 */
    setFlyWind(v) {
      if (!windNode || !ctx) return
      v = Math.max(0, Math.min(1, v || 0))
      if (Math.abs(v - flyWindV) < 0.04) return // 細かな変化は無視（無駄なスケジューリングを抑える）
      flyWindV = v
      const t = now()
      try {
        windNode.g.gain.setTargetAtTime(0.022 + v * 0.05, t, 0.35)       // 風量を速度で増す
        windNode.bp.frequency.setTargetAtTime(420 + v * 300, t, 0.35)    // 速いほど高い風切り
      } catch { /* 無視 */ }
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
    isStarted() {
      return started
    },
  }
}
