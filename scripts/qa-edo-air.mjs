// 江戸の島（東の城下町）の海岸線・地形の空撮確認。遠方エリアは距離カリングされるので飛行位置を島の近くへ飛ばしてから撮る。
// 使い方: node scripts/qa-edo-air.mjs  （PORT=4958 上書き可）。出力は .qa-shots/edo/。生WebGL（グレード無し）＝形の確認用。
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PORT = process.env.PORT || 4958
const BASE = `http://localhost:${PORT}/seasons/`
const OUT = path.join(ROOT, '.qa-shots', 'edo')
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true })

const srv = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, shell: true })
process.on('exit', () => { try { srv.kill() } catch {} })
const waitReady = async () => { for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE); if (r.ok) return true } catch {} await new Promise((r) => setTimeout(r, 250)) } throw new Error('preview not ready') }
const save = (name, dataUrl) => { if (!dataUrl) { console.log('NO URL', name); return } fs.writeFileSync(path.join(OUT, name), Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64')) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const TX = 640, TZ = -46
const VIEWS = [
  ['01-aerial-low.png', [TX + 6, 118, TZ + 240], [TX + 6, 6, TZ - 20], 56],   // 低い斜め俯瞰（南から島全体）
  ['02-map-top.png', [TX + 6, 305, TZ - 6], [TX + 6, 2, TZ - 6], 60],          // ほぼ真上（不定形の海岸線の輪郭）
  ['03-aerial-nw.png', [TX - 155, 125, TZ + 150], [TX + 10, 4, TZ - 20], 54],  // 北西からの斜俯瞰
  ['04-shore-low.png', [TX - 44, 36, TZ + 150], [TX - 30, 9, TZ - 6], 56],     // 低空＝汀のなだらかさ
  ['05-aerial-e.png', [TX + 210, 120, TZ + 40], [TX + 30, 4, TZ - 10], 54],    // 東（半島）からの俯瞰
]

;(async () => {
  await waitReady()
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 720, height: 560 } })
  const errs = []
  page.on('pageerror', (e) => errs.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|manifest|preload/i.test(m.text())) errs.push(m.text()) })
  await page.goto(BASE + '?dev=1', { waitUntil: 'networkidle' })
  await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-window-3d'))
  await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-window-3d'))
  for (let i = 0; i < 40; i++) { const ok = await page.evaluate(() => typeof window.__town3dShotAt === 'function'); if (ok) break; await sleep(250) }
  await page.evaluate(() => window.__town3dFly && window.__town3dFly(true))
  await sleep(1200)
  await page.evaluate(([tx, tz]) => window.__town3dFlyPose && window.__town3dFlyPose(tx + 10, 96, tz + 120, -Math.PI / 2, -0.25), [TX, TZ])
  await sleep(2200)
  const groundY = await page.evaluate(([tx, tz]) => window.__town3dGroundAt ? window.__town3dGroundAt(tx, tz) : null, [TX, TZ])
  console.log('江戸中心の地面高:', groundY)
  for (const [name, cam, look, fov] of VIEWS) {
    const url = await page.evaluate(([c, l, f]) => window.__town3dShotAt(c[0], c[1], c[2], l[0], l[1], l[2], f), [cam, look, fov])
    save(name, url)
  }
  console.log('errs:', errs.length); if (errs.length) console.log(errs.slice(0, 5).join('\n'))
  console.log('OUT:', OUT)
  await browser.close(); process.exit(0)
})().catch((e) => { console.error(e); process.exit(1) })
