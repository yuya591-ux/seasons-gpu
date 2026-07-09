import { chromium } from 'playwright'
const PORT = process.env.PORT || 4877
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 600, height: 700 } })
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2800)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(700)
await page.evaluate(() => window.__town3dCruise(false)); await page.waitForTimeout(300)
await page.evaluate(() => window.__town3dFlyPose(0, 9, 26, 0, -0.05)); await page.waitForTimeout(2400)
const r = await page.evaluate(() => {
  window.__town3dPeepFront(0, 4.5, 0.6)
  // 直後の位置と、少し待たずに読む
  return { resInfo0: (window.__town3dResInfo && window.__town3dResInfo()[0]) }
})
console.log('after PeepFront (immediate):', JSON.stringify(r))
await page.waitForTimeout(900)
// dbgで自機/カメラ位置
const dbg = await page.evaluate(() => window.__town3dDbg && window.__town3dDbg())
console.log('dbg:', JSON.stringify(dbg))
await browser.close()
