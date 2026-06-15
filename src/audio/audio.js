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
  let layers = [] // ループ中のレイヤー {layerGain, stopped}
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
    master.connect(ctx.destination)
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
    if (ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner()
      panner.pan.value = pan
      layerGain.connect(panner).connect(master)
    } else {
      layerGain.connect(master)
    }
    const layer = { layerGain, stopped: false }
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

  return {
    /** 最初のユーザー操作で呼ぶ。音脈を起こし、現在の情景の音を静かに立ち上げる。 */
    async start() {
      ensureContext()
      if (!ctx) return
      unlockMediaSession() // ジェスチャ起点で無音タグを再生＝iOSの消音スイッチを回避
      if (ctx.state === 'suspended') await ctx.resume()
      started = true
      if (currentScene) await playScene(currentScene, false)
    },
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
    isStarted() {
      return started
    },
  }
}
