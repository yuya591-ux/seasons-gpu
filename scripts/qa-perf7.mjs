// 性能の全状態計測(2026-07): 各モード×各エリアの描画コール/三角形/JS時間を採り、最も重い状態を特定する
import { chromium } from 'playwright'
const port = process.env.PORT || '4890'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2200)

const sample = async (name) => {
  await page.waitForTimeout(900)
  const d = await page.evaluate(() => window.__town3dDraw())
  const p = await page.evaluate(() => window.__town3dPerf ? window.__town3dPerf() : null)
  const jj = []
  for (let i = 0; i < 6; i++) { await page.waitForTimeout(220); const q = await page.evaluate(() => window.__town3dLoad ? window.__town3dLoad().jsMs : -1); jj.push(q) }
  const js = jj.filter((v) => v >= 0).sort((a, b) => a - b)
  console.log(`${name}: calls=${d.calls} tris=${(d.tris / 1000).toFixed(0)}k progs=${d.progs} jsMs(中央値)=${js.length ? js[(js.length / 2) | 0].toFixed(2) : '?'}`)
}
await sample('窓辺(既定)')
await page.evaluate(() => window.__town3dWindow(true)); await page.waitForTimeout(900)
await page.evaluate(() => window.__town3dLean(true)); await page.waitForTimeout(1200)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(500)
await page.evaluate(() => window.__town3dCruise(false))
const fly = async (x, y, z, yaw) => { await page.evaluate(([a, b, c, w]) => window.__town3dFlyPose(a, b, c, w || 0, 0), [x, y, z, yaw || 0]); await page.waitForTimeout(1100) }
await fly(0, 14, 8); await sample('home低空(街の中心y14)')
await fly(0, 45, -20); await sample('home中空(y45)')
await fly(-40, 12, -60, Math.PI / 2); await sample('home低空(住宅街西)')
await page.evaluate(() => window.__town3dLand(true)); await page.waitForTimeout(2500)
await sample('home歩行(着地)')
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(1200)
await fly(640, 20, -46); await sample('江戸低空')
await fly(-640, 20, -30); await sample('大正低空')
await fly(140, 22, -640); await sample('戦国低空')
await fly(0, 100, -150); await sample('雲海(y100)')
await fly(0, 60, 30, Math.PI); await sample('home一望(y60南から)')
await browser.close()
console.log('qa-perf7 done')
