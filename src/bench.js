// 発熱くらべ（WebGPU移行 Phase 1 の効果実証）。
// 同一の描画負荷を WebGL / WebGPU で5分ずつ描き、実機の電池減りと背面の温かさを手で記録して比べる。
// 実アプリと同じ節度: 毎秒30コマ上限・解像度倍率は端末値と1.6の小さい方・アンチエイリアスなし。
// QA用: ?mode=webgl|webgpu で自動開始、&secs=NN で計測秒を短縮。window.__benchStats() で数値取得。

const params = new URLSearchParams(location.search)
const SECS = Math.max(5, Number(params.get('secs')) || 300)

const menu = document.getElementById('menu')
const hud = document.getElementById('hud')
const done = document.getElementById('done')
const doneStats = document.getElementById('doneStats')
const canvas = document.getElementById('cv')
const gpuNote = document.getElementById('gpuNote')

gpuNote.textContent = 'gpu' in navigator ? 'この端末はWebGPUに対応しています。' : 'この端末のブラウザはWebGPU非対応です（iOSは26以上）。WebGPU側はWebGL2の代替で動きます。'

const errors = []
window.addEventListener('error', (e) => errors.push(String(e.message || e)))
window.addEventListener('unhandledrejection', (e) => errors.push(String(e.reason)))

let stats = { mode: '', backend: '', fps: 0, jsMs: 0, calls: 0, tris: 0, frames: 0, elapsed: 0, running: false }
window.__benchStats = () => ({ ...stats, errors: errors.slice(0, 5) })

let wakeLock = null
const keepAwake = async () => {
  try { wakeLock = await navigator.wakeLock?.request('screen') } catch { /* 非対応でも計測は続行 */ }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && stats.running) keepAwake() })

async function start(mode) {
  menu.style.display = 'none'
  hud.style.display = 'block'
  hud.textContent = '準備中…（初回は読み込みに少しかかります）'

  const { create } = mode === 'webgpu' ? await import('./benchGPU.js') : await import('./benchGL.js')
  let ctx
  try {
    ctx = await create(canvas)
  } catch (e) {
    errors.push(String(e))
    hud.textContent = `この方式はこの端末で開始できませんでした。\n${String(e).slice(0, 120)}`
    return
  }
  const { renderer, scene, cam, step, tris, backend, info } = ctx

  const DPR = Math.min(window.devicePixelRatio || 1, 1.6)
  renderer.setPixelRatio(DPR)
  const resize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight)
    cam.aspect = window.innerWidth / window.innerHeight
    cam.updateProjectionMatrix()
  }
  window.addEventListener('resize', resize)
  resize()
  keepAwake()

  stats = { mode, backend, fps: 0, jsMs: 0, calls: 0, tris, frames: 0, elapsed: 0, running: true }
  const t0 = performance.now()
  let last = 0
  let winFrames = 0
  let winJs = 0
  let winStart = t0
  let hudAt = 0

  const fmt = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`

  const loop = (now) => {
    if (!stats.running) return
    requestAnimationFrame(loop)
    if (now - last < 31) return // 30fps上限（実アプリと同じ）。単純リセット式＝60/120/144Hzのどれでも約30コマに収まる
    last = now

    const el = (now - t0) / 1000
    stats.elapsed = el
    const js0 = performance.now()
    step(el)
    renderer.render(scene, cam)
    const js = performance.now() - js0
    winFrames++
    winJs += js
    stats.frames++

    // 2秒窓で平均を更新（HUDのちらつき防止）
    if (now - winStart >= 2000) {
      stats.fps = (winFrames * 1000) / (now - winStart)
      stats.jsMs = winJs / winFrames
      const ri = info()
      stats.calls = ri.calls ?? 0
      stats.trisDrawn = ri.triangles ?? 0 // 実測＝両方式が同じ仕事をしている証拠
      winFrames = 0
      winJs = 0
      winStart = now
    }
    if (now - hudAt >= 500) {
      hudAt = now
      hud.textContent =
        `${backend}\n` +
        `計測 ${fmt(el)} / ${fmt(SECS)}\n` +
        `毎秒コマ数 ${stats.fps.toFixed(1)}\n` +
        `フレームCPU ${stats.jsMs.toFixed(2)} ms\n` +
        `描画コール ${stats.calls} ／ 三角形 ${((stats.trisDrawn || stats.tris) / 10000).toFixed(0)}万`
    }
    if (el >= SECS) finish()
  }

  const finish = () => {
    stats.running = false
    try { wakeLock?.release() } catch { /* 解放失敗は無害 */ }
    hud.style.display = 'none'
    done.style.display = 'flex'
    doneStats.textContent =
      `${backend}\n` +
      `平均フレームCPU ${stats.jsMs.toFixed(2)} ms\n` +
      `平均コマ数 ${stats.fps.toFixed(1)} ／ 描画コール ${stats.calls}`
  }

  requestAnimationFrame(loop)
}

document.getElementById('btnGL').addEventListener('click', () => start('webgl'))
document.getElementById('btnGPU').addEventListener('click', () => start('webgpu'))
document.getElementById('btnBack').addEventListener('click', () => location.reload())

const auto = params.get('mode')
if (auto === 'webgl' || auto === 'webgpu') start(auto)
