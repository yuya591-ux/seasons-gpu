// 雲海高度の描画コール内訳調査（案B-C4の調査ファースト）: skyDriftersの種類別・cloudObjs・cloudSeaの寄与を実測。
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PORT = 4989
const BASE = `http://localhost:${PORT}/seasons-gpu/`

const srv = spawn(`npx vite preview --port ${PORT} --strictPort`, { cwd: ROOT, shell: true, stdio: 'ignore' })
process.on('exit', () => { try { srv.kill() } catch {} })
for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE); if (r.ok) break } catch {} await new Promise((r) => setTimeout(r, 250)) }

const browser = await chromium.launch({ headless: false, args: ['--enable-unsafe-webgpu'] })
const page = await browser.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
page.on('pageerror', (e) => console.log('PAGEERR', String(e).slice(0, 160)))
await page.goto(`${BASE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(1200)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(8000)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(2000)
await page.evaluate(() => window.__town3dFlyPose(-30, 108, -320, 0, -0.15)); await page.waitForTimeout(2500)
// __town3dCloudBreak が無い場合に備え、ページ内で直接調査（devフックの__town3dStatsが返すobjs等でなく、視界内の実測）
const out = await page.evaluate(() => {
  if (!window.__town3dCloudBreak) return null
  return window.__town3dCloudBreak()
})
console.log(out ? JSON.stringify(out, null, 1) : '__town3dCloudBreak なし（要追加）')
await browser.close()
process.exit(0)
