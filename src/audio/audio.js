// 環境音のレイヤー再生。情景の sounds を個別音量で重ねてループする。
// ブラウザ制限により、最初のユーザー操作後にだけ鳴り始められる。
// 素材ファイルがまだ無い場合でも、エラーで止めず静かに無音で続行する。

export function createAudio() {
  let ctx = null
  let master = null
  let layers = [] // { id, source, gain, buffer }
  let currentScene = null
  let muted = false
  let volume = 0.8
  let started = false

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
      const res = await fetch(src)
      if (!res.ok) return null
      const arr = await res.arrayBuffer()
      return await ctx.decodeAudioData(arr)
    } catch {
      return null // 素材未配置・デコード不可は無音扱い
    }
  }

  function stopLayers() {
    layers.forEach((l) => {
      try {
        l.source.stop()
      } catch {
        /* 既に停止 */
      }
    })
    layers = []
  }

  async function playScene(scene) {
    currentScene = scene
    if (!started || !ctx) return
    stopLayers()
    for (const def of scene.sounds || []) {
      const buffer = await loadBuffer(def.src)
      if (!buffer) continue
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.loop = def.loop !== false
      const gain = ctx.createGain()
      gain.gain.value = def.gain != null ? def.gain : 1
      source.connect(gain).connect(master)
      source.start()
      layers.push({ id: def.id, source, gain, buffer })
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
      await playScene(scene)
      currentScene = scene
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
