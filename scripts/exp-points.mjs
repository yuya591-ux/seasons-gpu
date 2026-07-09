// 実験: WebGPURenderer での THREE.Points の実挙動（exp-points.html を両バックエンドで開いて実測）。
// 使い方: node scripts/exp-points.mjs （vite dev を自動起動。HEADED=1相当の実ウィンドウでWebGPU、ヘッドレスでWebGL2代替）
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PORT = 4973
const URL = `http://localhost:${PORT}/seasons-gpu/scripts/exp-points.html`
const OUT = path.join(ROOT, '.qa-shots', 'exp-points')
fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })

const srv = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: ROOT, shell: true })
process.on('exit', () => { try { srv.kill() } catch {} })
const waitReady = async () => {
  for (let i = 0; i < 120; i++) {
    try { const r = await fetch(URL); if (r.ok) return } catch {}
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error('dev server not ready')
}

;(async () => {
  await waitReady()
  for (const headed of [true, false]) {
    const browser = await chromium.launch({ headless: !headed, args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan'] })
    const page = await browser.newPage({ viewport: { width: 700, height: 460 } })
    const errs = []
    page.on('pageerror', (e) => errs.push(String(e)))
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
    await page.goto(URL, { waitUntil: 'networkidle' })
    await page.waitForFunction(() => window.__exp !== null, null, { timeout
: 30000 }).catch(() => {})
    const exp = await page.evaluate(() => window.__exp)
    await page.screenshot({ path: path.join(OUT, headed ? 'webgpu.png' : 'fallback.png') })
    console.log(`[${headed ? 'headed(WebGPU想定)' : 'headless(代替想定)'}]`, JSON.stringify(exp), 'consoleErr=', errs.slice(0, 3))
    await browser.close()
  }
  console.log('OUT:', OUT)
  process.exit(0)
})().catch((e) => { console.error(e); process.exit(1) })
