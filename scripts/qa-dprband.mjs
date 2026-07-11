// 飛行中の解像度帯（案B-C2）の機能検証: 窓辺=1.6 → 飛行=1.2 → 窓へ戻る=1.6 のDPR遷移を実測する。
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PORT = 4987
const BASE = `http://localhost:${PORT}/seasons-gpu/`

const srv = spawn(`npx vite preview --port ${PORT} --strictPort`, { cwd: ROOT, shell: true, stdio: 'ignore' })
process.on('exit', () => { try { srv.kill() } catch {} })
for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE); if (r.ok) break } catch {} await new Promise((r) => setTimeout(r, 250)) }

const browser = await chromium.launch({ headless: false, args: ['--enable-unsafe-webgpu'] })
const page = await browser.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
const errs = []
page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)))
await page.goto(`${BASE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(1200)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(8000)
const pr = () => page.evaluate(() => window.__town3dStats ? window.__town3dStats().pr : null)
const atWindow = await pr()
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(3000)
const atFly = await pr()
await page.evaluate(() => window.__town3dFly(false)); await page.waitForTimeout(3000)
const backWindow = await pr()
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(2500)
await page.evaluate(() => window.__town3dLand(true)); await page.waitForTimeout(4000)
const atWalk = await pr()
console.log(`窓辺=${atWindow} 飛行=${atFly} 窓へ帰還=${backWindow} 着地歩行=${atWalk} errs=${errs.length}`, errs.slice(0, 3))
const ok = atWindow === 1.6 && atFly === 1.2 && backWindow === 1.6 && atWalk === 1.6 && errs.length === 0
console.log(ok ? 'OK: DPR帯は設計どおり' : 'NG: 期待値と不一致')
await browser.close()
process.exit(ok ? 0 : 1)
