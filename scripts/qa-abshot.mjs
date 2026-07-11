// 同一ランA/Bスクショ比較: 2つのURLパラメータで同じ情景・同じポーズを開き、スクショと画素差を出す。
// 使い方: node scripts/qa-abshot.mjs "<paramsA>" "<paramsB>" [window|fly|cloud]
// 例: node scripts/qa-abshot.mjs "dpr=1.6&fullcss=1" "dpr=1.6" window
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PORT = 4985
const BASE = `http://localhost:${PORT}/seasons-gpu/`
const OUT = path.join(ROOT, '.qa-shots', 'perf')
fs.mkdirSync(OUT, { recursive: true })

const [qa, qb, scn = 'window'] = process.argv.slice(2)
const SCENARIOS = {
  window: { scene: 'kitaterao-window-3d-night', fly: null },
  windowday: { scene: 'kitaterao-window-3d', fly: null },
  fly:    { scene: 'kitaterao-window-3d', fly: [0, 26, 18, 0, -0.12] },
  cloud:  { scene: 'kitaterao-window-3d', fly: [-30, 108, -320, 0, -0.15] },
}
const sc = SCENARIOS[scn]

const srv = spawn(`npx vite preview --port ${PORT} --strictPort`, { cwd: ROOT, shell: true, stdio: 'ignore' })
process.on('exit', () => { try { srv.kill() } catch {} })
for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE); if (r.ok) break } catch {} await new Promise((r) => setTimeout(r, 250)) }

const browser = await chromium.launch({ headless: false, args: ['--enable-unsafe-webgpu'] })
const context = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })

const shoot = async (q, tag) => {
  const page = await context.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}?dev=1${q ? '&' + q : ''}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.locator('.gate').click().catch(() => {})
  await page.waitForTimeout(1200)
  await page.evaluate((i) => window.__applyScene(i), sc.scene)
  await page.waitForTimeout(8000)
  if (sc.fly) {
    await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(2500)
    await page.evaluate((p) => window.__town3dFlyPose(...p), sc.fly); await page.waitForTimeout(3500) // 引いた三人称カメラとズームの整定
    await page.evaluate((p) => window.__town3dFlyPose(...p), sc.fly); await page.waitForTimeout(1500) // 構図をペア間で完全一致させる
  }
  const stats = await page.evaluate(() => window.__town3dStats ? window.__town3dStats() : null)
  const file = path.join(OUT, `ab-${scn}-${tag}.png`)
  await page.screenshot({ path: file })
  console.log(`[${tag}] q="${q}" pr=${stats && stats.pr} errs=${errs.length}`, errs.slice(0, 2))
  await page.close()
  return file
}

const fa = await shoot(qa, 'a')
const fb = await shoot(qb, 'b')

const page = await context.newPage()
await page.goto('about:blank')
const d = await page.evaluate(async ([sa, sb]) => {
  const load = (s) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = 'data:image/png;base64,' + s })
  const [ia, ib] = await Promise.all([load(sa), load(sb)])
  const W = 393, H = 852
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const cx = cv.getContext('2d', { willReadFrequently: true })
  cx.drawImage(ia, 0, 0, W, H); const da = cx.getImageData(0, 0, W, H).data
  cx.clearRect(0, 0, W, H); cx.drawImage(ib, 0, 0, W, H); const db = cx.getImageData(0, 0, W, H).data
  let sum = 0
  for (let i = 0; i < da.length; i += 4) sum += Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2])
  return +(sum / (W * H * 3) / 2.55).toFixed(3)
}, [fs.readFileSync(fa).toString('base64'), fs.readFileSync(fb).toString('base64')])
console.log(`diff mean=${d}%  (${fa} vs ${fb})`)
await browser.close()
process.exit(0)
