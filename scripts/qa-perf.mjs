// iPhone模擬の要素別性能計測ハーネス（バランス最適化 Phase 1 自動計測）。
// 条件: ビューポート393×852・deviceScaleFactor 3・CPU 4倍スロットル（CDP）・実ウィンドウ=本物のWebGPU。
//
// 計測プロトコル=「ペア比較」: デスクトップはCPUブースト減衰で実行順に遅くなるため、
// 各要素を [基準(base)→要素OFF] の隣接ペアで測り、直近baseとの差分をその要素のコストとする（熱ドリフト相殺）。
// 基準は dpr=1.6 固定（自動品質を凍結し、要素の有無「だけ」を比較する公平条件）。
// 併せて base同士のペア（noise）でfps・画素差のノイズ床を採る。auto=出荷時そのまま（自動品質が動く参照）。
//
// 使い方: 事前に npx vite build → SCENARIO=window|fly|cloud node scripts/qa-perf.mjs
// 出力: .qa-shots/perf/<scenario>-<config>.png と .qa-shots/perf/results-<scenario>.json
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PORT = 4983
const BASE = `http://localhost:${PORT}/seasons-gpu/`
const OUT = path.join(ROOT, '.qa-shots', 'perf')
fs.mkdirSync(OUT, { recursive: true })

const SCENARIO = process.env.SCENARIO || 'fly'
const FILTER = process.env.FILTER || '' // 例: FILTER=noise → そのペアだけ実行（変更前後の素早い再計測用）
const CPU_RATE = 4           // iPhone模擬のCPUスロットル倍率
const PIN = 'dpr=1.6'        // 基準構成（標準品質の上限に固定・自動品質凍結）

// シナリオ: 情景＋（必要なら）飛行ポーズ。yaw=0が街向き（実測: yaw=0で描画コール1076-1386/πでは67=空向き）。
const SCENARIOS = {
  window: { scene: 'kitaterao-window-3d-night', fly: null, note: '窓辺・夜（描画コール最大・ブルーム強）' },
  fly:    { scene: 'kitaterao-window-3d', fly: [0, 26, 18, 0, -0.12], note: '低空飛行・昼（能動移動の代表）' },
  cloud:  { scene: 'kitaterao-window-3d', fly: [-30, 108, -320, 0, -0.15], note: '雲海高度（半透明の重ね塗り最大）' },
}

// 要素リスト: [名前, URLパラメータ]（__BLOOM_OFF__は実行時フックで切る）
const ELEMENTS = {
  window: [
    ['noise', PIN],
    ['nocss', `nocss=1&${PIN}`], ['nofx', `nofx=1&${PIN}`], ['bloomoff', '__BLOOM_OFF__'],
    ['noshadow', `noshadow=1&${PIN}`],
    ['dpr096', 'dpr=0.96'], ['dpr12', 'dpr=1.2'], ['dpr20', 'dpr=2'],
  ],
  fly: [
    ['noise', PIN],
    ['nocss', `nocss=1&${PIN}`], ['nofx', `nofx=1&${PIN}`], ['noshadow', `noshadow=1&${PIN}`],
    ['dpr096', 'dpr=0.96'], ['dpr12', 'dpr=1.2'],
    ['combo', `nocss=1&nofx=1&noshadow=1&${PIN}`],
  ],
  cloud: [
    ['noise', PIN],
    ['noalpha', `noalpha=1&${PIN}`], ['nocss', `nocss=1&${PIN}`], ['nofx', `nofx=1&${PIN}`], ['dpr096', 'dpr=0.96'],
  ],
}

const srv = spawn(`npx vite preview --port ${PORT} --strictPort`, { cwd: ROOT, shell: true, stdio: 'ignore' })
process.on('exit', () => { try { srv.kill() } catch {} })
for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE); if (r.ok) break } catch {} await new Promise((r) => setTimeout(r, 250)) }

const browser = await chromium.launch({ headless: false, args: ['--enable-unsafe-webgpu'] })
const context = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
const sc = SCENARIOS[SCENARIO]

// 1構成を開いて定常状態を測り、スクショを保存して閉じる
async function runOne(tag, params) {
  const isBloomOff = params === '__BLOOM_OFF__'
  const q = isBloomOff ? PIN : params
  const page = await context.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)))
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|manifest/i.test(m.text())) errs.push(m.text().slice(0, 160)) })
  await page.goto(`${BASE}?dev=1${q ? '&' + q : ''}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.bringToFront()
  await page.locator('.gate').click().catch(() => {})
  await page.waitForTimeout(1200)
  await page.evaluate((i) => window.__applyScene(i), sc.scene)
  await page.waitForTimeout(8000) // 構築＋影焼き＋compile先行
  if (sc.fly) {
    await page.evaluate(() => window.__town3dFly(true))
    await page.waitForTimeout(2000)
    await page.evaluate((p) => window.__town3dFlyPose(...p), sc.fly)
    await page.waitForTimeout(2000)
  }
  if (isBloomOff) await page.evaluate(() => window.__town3dBloom && window.__town3dBloom(false))
  // ここからCPUスロットル（マウントは素の速度・定常状態だけiPhone相当のCPUで測る）
  const cdp = await context.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_RATE })
  await page.waitForTimeout(1000)
  if (sc.fly) await page.evaluate((p) => window.__town3dFlyPose(...p), sc.fly) // 位置ドリフトを消しポーズ固定
  // idle落ち（16fps）を防ぐ「ひと触り」（右側=見回し・2px=構図ほぼ不変）を挟みつつ6秒サンプル
  const f0 = await page.evaluate(() => ({ f: window.__town3dFrame(), t: performance.now() }))
  const jsSamples = []
  for (let i = 0; i < 3; i++) {
    await page.mouse.move(300, 500); await page.mouse.down(); await page.mouse.move(302, 500); await page.mouse.up()
    await page.waitForTimeout(2000)
    const ld = await page.evaluate(() => window.__town3dLoad ? window.__town3dLoad() : null)
    if (ld) jsSamples.push(ld.jsMs)
  }
  const f1 = await page.evaluate(() => ({ f: window.__town3dFrame(), t: performance.now() }))
  const fps = (f1.f - f0.f) / ((f1.t - f0.t) / 1000)
  const jsMs = jsSamples.length ? jsSamples.reduce((a, b) => a + b, 0) / jsSamples.length : -1
  const draw = await page.evaluate(() => window.__town3dDraw ? window.__town3dDraw() : null)
  const stats = await page.evaluate(() => window.__town3dStats ? window.__town3dStats() : null)
  // スクショ（CSS層込みの本当の見え方）。ポーズを再固定して1秒置き、ペア間で同一構図に
  if (sc.fly) await page.evaluate((p) => window.__town3dFlyPose(...p), sc.fly)
  await page.waitForTimeout(1000)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  await page.screenshot({ path: path.join(OUT, `${SCENARIO}-${tag}.png`) })
  await page.close()
  return {
    tag, params: isBloomOff ? PIN + ' + bloom off(実行時)' : q,
    fps: +fps.toFixed(2), frameMs: +(1000 / Math.max(fps, 0.01)).toFixed(1), jsMs: +(+jsMs).toFixed(2),
    calls: draw ? draw.calls : -1, tris: draw ? draw.tris : -1,
    pr: stats && stats.pr !== undefined ? stats.pr : null,
    errs: errs.length, errSamples: errs.slice(0, 2),
  }
}

const results = { scenario: SCENARIO, note: sc.note, cpuRate: CPU_RATE, viewport: '393x852@3', auto: null, pairs: [] }

// 出荷時そのまま（自動品質あり）の参照
results.auto = await runOne('auto', '')
console.log(`[${SCENARIO}/auto] fps=${results.auto.fps} jsMs=${results.auto.jsMs} calls=${results.auto.calls} pr=${results.auto.pr} errs=${results.auto.errs}`)

// ペア比較: base(基準) → 要素OFF を隣接実行し、差分=その要素のコスト
for (const [name, params] of ELEMENTS[SCENARIO].filter(([n]) => !FILTER || n === FILTER)) {
  const ref = await runOne(`ref-${name}`, PIN)
  const el = await runOne(name, params)
  const pair = { name, ref, el, dFps: +(el.fps - ref.fps).toFixed(2), dFrameMs: +(el.frameMs - ref.frameMs).toFixed(1) }
  results.pairs.push(pair)
  console.log(`[${SCENARIO}/${name}] ref=${ref.fps}fps(${ref.frameMs}ms) el=${el.fps}fps(${el.frameMs}ms) Δfps=${pair.dFps} Δms=${pair.dFrameMs} calls ${ref.calls}→${el.calls} errs=${ref.errs + el.errs}`)
}

// ── スクショの画素差（絵への貢献度）: ペアの2枚を393×852に縮めて平均絶対差(%)と局所最大(32px块)を出す ──
const diffPage = await context.newPage()
await diffPage.goto('about:blank')
const b64 = (p) => fs.readFileSync(p).toString('base64')
for (const pair of results.pairs) {
  const pa = path.join(OUT, `${SCENARIO}-ref-${pair.name}.png`), pb = path.join(OUT, `${SCENARIO}-${pair.name}.png`)
  if (!fs.existsSync(pa) || !fs.existsSync(pb)) continue
  const d = await diffPage.evaluate(async ([a, b]) => {
    const load = (s) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = 'data:image/png;base64,' + s })
    const [ia, ib] = await Promise.all([load(a), load(b)])
    const W = 393, H = 852
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const cx = cv.getContext('2d', { willReadFrequently: true })
    cx.drawImage(ia, 0, 0, W, H); const da = cx.getImageData(0, 0, W, H).data
    cx.clearRect(0, 0, W, H); cx.drawImage(ib, 0, 0, W, H); const db = cx.getImageData(0, 0, W, H).data
    let sum = 0
    const BS = 32, bw = Math.ceil(W / BS)
    const blocks = new Float64Array(bw * Math.ceil(H / BS)), bn = new Float64Array(blocks.length)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      const dd = Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2])
      sum += dd
      const bi = ((y / BS) | 0) * bw + ((x / BS) | 0); blocks[bi] += dd; bn[bi]++
    }
    let bmax = 0
    for (let i = 0; i < blocks.length; i++) if (bn[i]) bmax = Math.max(bmax, blocks[i] / bn[i])
    return { mean: +(sum / (W * H * 3) / 2.55).toFixed(3), blockMax: +(bmax / 3 / 2.55).toFixed(2) } // %（0-100）
  }, [b64(pa), b64(pb)])
  pair.diffMean = d.mean; pair.diffBlockMax = d.blockMax
  console.log(`[diff ${SCENARIO}/${pair.name}] mean=${d.mean}% blockMax=${d.blockMax}%`)
}
await diffPage.close()

// 飛行シナリオでは描画コールのカテゴリ寄与も1回だけ採る（どこがコールを食っているか）
if (SCENARIO === 'fly' && !FILTER) {
  const page = await context.newPage()
  await page.goto(`${BASE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.locator('.gate').click().catch(() => {})
  await page.waitForTimeout(1200)
  await page.evaluate((i) => window.__applyScene(i), sc.scene)
  await page.waitForTimeout(8000)
  await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(2000)
  await page.evaluate((p) => window.__town3dFlyPose(...p), sc.fly); await page.waitForTimeout(2000)
  const attr = await page.evaluate(() => window.__town3dAttribute ? window.__town3dAttribute() : null)
  const histo = await page.evaluate(() => window.__town3dMeshHisto ? window.__town3dMeshHisto() : null)
  fs.writeFileSync(path.join(OUT, 'fly-attribute.json'), JSON.stringify({ attr, histo }, null, 1))
  console.log('[attribute]', JSON.stringify(attr))
  await page.close()
}

fs.writeFileSync(path.join(OUT, `results-${SCENARIO}.json`), JSON.stringify(results, null, 1))
console.log('WROTE', path.join(OUT, `results-${SCENARIO}.json`))
await browser.close()
process.exit(0)
