// CSS層の純粋な寄与計測: 同一ページ内で層をその場で隠して撮り比べる（世界の状態が完全同一＝アニメ差ゼロ）。
// A=旧4層(fullcss=1) / B=wash残し(paper2+bleedを隠す=C1採用案) / C=紙目のみ(washも隠す=C1初案)。
// 使い方: node scripts/qa-cssab.mjs [シーンID...]（既定: 夜と昼の窓辺）
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PORT = 4986
const BASE = `http://localhost:${PORT}/seasons-gpu/`
const OUT = path.join(ROOT, '.qa-shots', 'perf')
fs.mkdirSync(OUT, { recursive: true })
const SCENES = process.argv.slice(2).length ? process.argv.slice(2) : ['kitaterao-window-3d-night', 'kitaterao-window-3d']

const srv = spawn(`npx vite preview --port ${PORT} --strictPort`, { cwd: ROOT, shell: true, stdio: 'ignore' })
process.on('exit', () => { try { srv.kill() } catch {} })
for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE); if (r.ok) break } catch {} await new Promise((r) => setTimeout(r, 250)) }

const browser = await chromium.launch({ headless: false, args: ['--enable-unsafe-webgpu'] })
const context = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })

const diff = async (page, fa, fb) => page.evaluate(async ([sa, sb]) => {
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

for (const scene of SCENES) {
  const page = await context.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}?dev=1&dpr=1.6&fullcss=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.locator('.gate').click().catch(() => {})
  await page.waitForTimeout(1200)
  await page.evaluate((i) => window.__applyScene(i), scene)
  await page.waitForTimeout(8000)
  const hide = (sels, on) => page.evaluate(([ss, o]) => { for (const s of ss) { const el = document.querySelector(s); if (el) el.style.display = o ? 'none' : '' } }, [sels, on])
  const shot = async (tag) => { const f = path.join(OUT, `cssab-${scene}-${tag}.png`); await page.screenshot({ path: f }); return f }
  const fa = await shot('a4layers')
  await hide(['.town3d-paper2', '.town3d-bleed'], true); await page.waitForTimeout(400)
  const fb = await shot('b-washkeep')
  await hide(['.town3d-wash'], true); await page.waitForTimeout(400)
  const fc = await shot('c-paperonly')
  const dab = await diff(page, fa, fb)
  const dac = await diff(page, fa, fc)
  console.log(`[${scene}] 旧4層vs wash残し: ${dab}% ／ 旧4層vs 紙目のみ: ${dac}% errs=${errs.length}`, errs.slice(0, 2))
  await page.close()
}
await browser.close()
process.exit(0)
