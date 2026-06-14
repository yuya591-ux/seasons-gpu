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

  function ensureContext() {
    if (ctx) return
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0.0001 // 無音から始めてフェードイン
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
      const s = nextStart
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
      const delay = Math.max(60, (nextStart - now() - 1.2) * 1000)
      const id = setTimeout(schedule, delay)
      timers.push(id)
    }
    schedule()
  }

  // 単発（遠雷）。鳴るたびに音量・低域・再生速度・定位を揺らし「毎回違う距離の雷」に。
  function playCue(buffer, def) {
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.playbackRate.value = 0.9 + Math.random() * 0.25
    const g = ctx.createGain()
    const baseGain = def.gain != null ? def.gain : 0.5
    g.gain.value = baseGain * (0.55 + Math.random() * 0.55)
    let node = src.connect(g)
    if (ctx.createBiquadFilter) {
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 600 + Math.random() * 2200 // 遠いほど高域が削れる
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
