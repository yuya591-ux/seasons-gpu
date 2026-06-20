// 総合スモーク: 全変更後にコンソールエラーが出ないか（窓→空→着地→目的地→夜）を一気に通す。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
let errs = 0
page.on('pageerror', (e) => { errs++; console.log('PAGE ERROR', e.message) })
page.on('console', (m) => { if (m.type() === 'error') { errs++; console.log('CONSOLE ERROR', m.text()) } })
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
for (const scene of ['kitaterao-window-3d', 'kitaterao-window-3d-night']) {
  await page.evaluate((s) => window.__applyScene(s), scene); await page.waitForTimeout(2200)
  await page.evaluate(() => { window.__town3dFly(true) }); await page.waitForTimeout(600)
  await page.evaluate(() => window.__town3dFlyPose(415, 44, -46, Math.PI / 2, -0.1)); await page.waitForTimeout(600) // 江戸
  await page.evaluate(() => window.__town3dFlyPose(50, 30, -430, 0.2, -0.12)); await page.waitForTimeout(600) // 戦国
  await page.evaluate(() => { window.__town3dLand(true) }); await page.waitForTimeout(800) // 着地して歩く
  await page.evaluate(() => { window.__town3dLand(false) }); await page.waitForTimeout(400)
}
console.log(errs === 0 ? 'SMOKE OK (no errors)' : `SMOKE FAIL (${errs} errors)`)
await browser.close()
