// 移植デバッグ用: 本番ビルド(preview)で3D情景を開き、最初のエラー位置をsourcemapで実体に写して出す。
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PORT = 4975
const SCENE = process.env.SCENE || 'kitaterao-window-3d'
const URL = `http://localhost:${PORT}/seasons-gpu/?scene=${SCENE}&dev=1`

const srv = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, shell: true })
process.on('exit', () => { try { srv.kill() } catch {} })
const waitReady = async () => {
  for (let i = 0; i < 120; i++) {
    try { const r = await fetch(`http://localhost:${PORT}/seasons-gpu/`); if (r.ok) return } catch {}
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error('preview not ready')
}

;(async () => {
  await waitReady()
  const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu'] })
  const page = await browser.newPage({ viewport: { width: 500, height: 800 } })
  const errs = []
  page.on('pageerror', (e) => errs.push(e.stack || String(e)))
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
  await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'domcontentloaded' })
  await page.locator('.gate').click().catch(() => {})
  await page.waitForTimeout(1200)
  // qa-smoke と同じ「二度当て」＝マウント途中の再マウントで起きる問題を再現する
  await page.evaluate((i) => window.__applyScene(i), SCENE)
  await page.waitForTimeout(700)
  await page.evaluate((i) => window.__applyScene(i), SCENE)
  await page.waitForTimeout(12000)
  console.log(errs.slice(0, 4).join('\n----\n').slice(0, 2000))
  // スタックの town3dViewer 内の位置を sourcemap で実体へ写す
  const m = (errs.join('\n').match(/town3dViewer-[\w-]+\.js:(\d+):(\d+)/))
  if (m) {
    const line = +m[1], col = +m[2]
    const file = fs.readdirSync(path.join(ROOT, 'dist/assets')).find((f) => /^town3dViewer-.*\.js\.map$/.test(f))
    const sm = JSON.parse(fs.readFileSync(path.join(ROOT, 'dist/assets', file), 'utf8'))
    const { TraceMap, originalPositionFor } = await import('@jridgewell/trace-mapping').catch(() => ({}))
    if (TraceMap) {
      const tm = new TraceMap(sm)
      const pos = originalPositionFor(tm, { line, column: col })
      console.log('ORIGINAL:', JSON.stringify(pos))
    } else {
      console.log('trace-mapping 不在: line', line, 'col', col)
    }
  }
  await browser.close()
  process.exit(0)
})().catch((e) => { console.error(e); process.exit(1) })
