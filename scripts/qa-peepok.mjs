import { chromium } from 'playwright'
const PORT = process.env.PORT || 4877
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 600, height: 720 }, deviceScaleFactor: 2 })
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2800)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(700)
await page.evaluate(() => window.__town3dCruise(false)); await page.waitForTimeout(300)
await page.evaluate(() => window.__town3dFlyPose(0, 2.0, 8, 0, -0.12)); await page.waitForTimeout(1600) // 低姿勢で settle（face_0と同条件）
for (const i of [0, 5, 10, 20]) {
  await page.evaluate((i) => window.__town3dPeepFront(i, 4.5, 0.6), i)
  await page.waitForTimeout(900)
  await page.screenshot({ path: `scripts/_shots/peepok_${i}.png` })
  console.log('peepok', i)
}
await browser.close()
