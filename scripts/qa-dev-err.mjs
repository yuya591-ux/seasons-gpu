// 移植デバッグ用: vite dev（非ミニファイ）で3D情景を開き、最初のエラーのスタックをそのまま出す。
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PORT = 4974
const SCENE = process.env.SCENE || 'kitaterao-window-3d'
const URL = `http://localhost:${PORT}/seasons-gpu/?scene=${SCENE}&dev=1`

const srv = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: ROOT, shell: true })
process.on('exit', () => { try { srv.kill() } catch {} })
const waitReady = async () => {
  for (let i = 0; i < 120; i++) {
    try { const r = await fetch(`http://localhost:${PORT}/seasons-gpu/`); if (r.ok) return } catch {}
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error('dev server not ready')
}

;(async () => {
  await waitReady()
  const browser = await chromium.launch({ headless: process.env.HEADED !== '1', args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan'] })
  const page = await browser.newPage({ viewport: { width: 500, height: 800 } })
  page.on('pageerror', (e) => console.log('[pageerror]', e.stack || String(e)))
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[${m.type()}]`, m.text().slice(0, 1200)) })
  await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'domcontentloaded' })
  await page.locator('.gate').click().catch(() => {})
  await page.waitForTimeout(1200)
  await page.evaluate((i) => window.__applyScene(i), SCENE)
  await page.waitForTimeout(700)
  await page.evaluate((i) => window.__applyScene(i), SCENE)
  await new Promise((r) => setTimeout(r, 15000))
  const shot = path.join(ROOT, '.qa-shots', 'dev-err.png')
  await page.screenshot({ path: shot })
  console.log('SHOT:', shot)
  await browser.close()
  process.exit(0)
})().catch((e) => { console.error(e); process.exit(1) })
