// 診断HUD（?hud=1）と WebGL2代替強制（?gl=1）の動作確認。実ウィンドウで両方を開いてHUD文字列とバックエンドを読む。
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PORT = 4977
const BASE = `http://localhost:${PORT}/seasons-gpu/`

const srv = spawn(`npx vite preview --port ${PORT} --strictPort`, { cwd: ROOT, shell: true, stdio: 'ignore' })
process.on('exit', () => { try { srv.kill() } catch {} })
for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE); if (r.ok) break } catch {} await new Promise((r) => setTimeout(r, 250)) }

const browser = await chromium.launch({ headless: false, args: ['--enable-unsafe-webgpu'] })
for (const q of ['hud=1', 'hud=1&gl=1']) {
  const page = await browser.newPage({ viewport: { width: 480, height: 800 } })
  const errs = []
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)))
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|manifest/i.test(m.text())) errs.push(m.text().slice(0, 160)) })
  await page.goto(`${BASE}?dev=1&${q}`, { waitUntil: 'domcontentloaded' })
  await page.locator('.gate').click().catch(() => {})
  await page.waitForTimeout(1500)
  await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
  await page.waitForTimeout(9000)
  const hud = await page.evaluate(() => { const el = document.querySelector('.town3d-stage div[style*="monospace"]'); return el ? el.textContent : null })
  const backend = await page.evaluate(() => window.__town3dBackend ? window.__town3dBackend() : null)
  console.log(`[?${q}] backend=${backend} hud=${JSON.stringify(hud)} errs=${errs.length}`, errs.slice(0, 2))
  await page.close()
}
await browser.close()
process.exit(0)
