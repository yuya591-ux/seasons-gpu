// 環境音のレイヤー再生。情景の sounds を個別音量で重ねる。
// ループ音（雨・ヒグラシ）は流しっぱなし、loop:false で interval を持つ音（遠雷）は
// ランダムな間隔で時々鳴らす。ブラウザ制限により最初のユーザー操作後にだけ鳴り始める。
// 素材ファイルが無くてもエラーで止めず静かに無音で続行する。

export function createAudio(opts) {
  const onCue = (opts && opts.onCue) || null // 音の発火を画面に伝える（遠雷フラッシュ等）
  let ctx = null
  let master = null
  let loopSources = [] // ループ再生中の source
  let timers = [] // ランダム再生のタイマー
  let currentScene = null
  let muted = false
  let volume = 0.8
  let started = false
  let gen = 0 // 情景の世代。切替で増やし、進行中の読み込み・タイマー連鎖を無効化する

  // GitHub Pages のサブパス（/seasons/）配下でも正しく解決する。
  const base = import.meta.env.BASE_URL || '/'
  const urlOf = (src) => base + src

  function ensureContext() {
    if (ctx) return
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = muted ? 0 : volume
    master.connect(ctx.destination)
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

  function playOnce(buffer, gainValue) {
    const source = ctx.createBufferSource()
    source.buffer = buffer
    const gain = ctx.createGain()
    gain.gain.value = gainValue != null ? gainValue : 1
    source.connect(gain).connect(master)
    source.start()
  }

  // loop:false + interval:[min,max] の音を、ランダム間隔で繰り返し鳴らす。
  // myGen が現在の世代でなくなったら連鎖を止める（古い情景のタイマーが残らない）。
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
            if (myGen === gen && started && ctx) playOnce(buffer, def.gain)
          }, lead)
        }
        next()
      }, delay)
      timers.push(id)
    }
    next()
  }

  function stopAll() {
    gen++ // 進行中の playScene の読み込み・タイマー連鎖を無効化
    loopSources.forEach((s) => {
      try {
        s.stop()
      } catch {
        /* 既に停止 */
      }
    })
    timers.forEach((id) => clearTimeout(id))
    loopSources = []
    timers = []
  }

  async function playScene(scene) {
    currentScene = scene
    if (!started || !ctx) return
    stopAll()
    const myGen = gen
    for (const def of scene.sounds || []) {
      const buffer = await loadBuffer(def.src)
      if (myGen !== gen) return // 読み込み中に別情景へ切替わった→破棄
      if (!buffer) continue
      if (def.loop !== false) {
        const source = ctx.createBufferSource()
        source.buffer = buffer
        source.loop = true
        const gain = ctx.createGain()
        gain.gain.value = def.gain != null ? def.gain : 1
        source.connect(gain).connect(master)
        source.start()
        loopSources.push(source)
      } else if (def.interval) {
        scheduleInterval(def, buffer, myGen)
      } else {
        playOnce(buffer, def.gain)
      }
    }
  }

  return {
    /** 最初のユーザー操作で呼ぶ。音脈を起こし、現在の情景の音を鳴らす。 */
    async start() {
      ensureContext()
      if (!ctx) return
      if (ctx.state === 'suspended') await ctx.resume()
      started = true
      if (currentScene) await playScene(currentScene)
    },
    /** 情景を切り替える（音も差し替える）。 */
    async setScene(scene) {
      currentScene = scene
      await playScene(scene)
    },
    setMuted(m) {
      muted = m
      if (master) master.gain.value = muted ? 0 : volume
    },
    setVolume(v) {
      volume = v
      if (master && !muted) master.gain.value = volume
    },
    isStarted() {
      return started
    },
  }
}
