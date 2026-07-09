// WebGPU移植の見た目検証: 実ウィンドウ（本物のWebGPU）で代表情景を開き、
// backend確認＋コンソールエラー確認＋page.screenshot（CSS水彩グレード込みの本当の見え方）を撮る。
// 使い方: node scripts/qa-webgpu-shots.mjs （要: 事前に npx vite build）
// 比較用に BASE_URL を本家に向ければ同じ画角で本家のスクショも撮れる:
//   BASE_URL=https://yuya591-ux.github.io/seasons/ node scripts/qa-webgpu-shots.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PORT = 4976
const EXT = process.env.BASE_URL || ''
const BASE = EXT || `http://localhost:${PORT}/seasons-gpu/`
const TAG = EXT ? 'honke' : 'wgpu'
const OUT = path.join(ROOT, '.qa-shots', 'webgpu-ab')
fs.mkdirSync(OUT, { recursive: true })

const SCENES = [
  'kitaterao-window-3d',          // 窓辺・昼（旗艦3D）
  'kitaterao-window-3d-sunset',   // 夕（ブルーム・空の色）
  'kitaterao-window-3d-night',    // 夜（星・灯り・ブルーム強）
  'kitaterao-window-3d-rain',     // 雨（雨脚・濡れた路面）
  'kitaterao-window-3d-snow',     // 雪（snowify・白の乗り）
  'shishigaya-window-3d',         // 谷戸（棚田の水鏡=freshWater）
]

let srv = null
if (!EXT) {
  srv = spawn(`npx vite preview --port ${PORT} --strictPort`, { cwd: ROOT, shell: true, stdio: 'ignore' })
  process.on('exit', () => { try { srv.kill() } catch {} })
  for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE); if (r.ok) break } catch {} await new Promise((r) => setTimeout(r, 250)) }
}

const browser = await chromium.launch({ headless: false, args: ['--enable-unsafe-webgpu'] })
const page = await browser.newPage({ viewport: { width: 480, height: 800 } })
const errs = []
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|manifest/i.test(m.text())) errs.push(m.text().slice(0, 200)) })
await page.goto(`${BASE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(1500)

for (const id of SCENES) {
  await page.evaluate((i) => window.__applyScene(i), id)
  await page.waitForTimeout(6000) // 構築＋影焼き＋数フレーム
  await page.mouse.move(240, 400); await page.mouse.down(); await page.mouse.move(250, 400); await page.mouse.up() // idle落ち防止のひと触り
  await page.waitForTimeout(800)
  await page.screenshot({ path: path.join(OUT, `${TAG}-${id}.png`) })
  const st = await page.evaluate(() => window.__town3dStats ? window.__town3dStats() : null)
  console.log(`[${id}] stats=${JSON.stringify(st)}`)
}
const backend = await page.evaluate(() => window.__town3dBackend ? window.__town3dBackend() : null)
console.log('backend:', backend)
console.log('errors:', errs.length, errs.slice(0, 6))
console.log('OUT:', OUT)
await browser.close()
process.exit(errs.length ? 1 : 0)
