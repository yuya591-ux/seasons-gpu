import { chromium } from 'playwright'
const PORT = process.env.PORT || 4876
const tag = process.argv[2] || 'before'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 600, height: 760 }, deviceScaleFactor: 2 })
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2600)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(700)
await page.evaluate(() => window.__town3dCruise(false)); await page.waitForTimeout(300)
await page.evaluate(() => window.__town3dFlyPose(0, 10, 24, 0, -0.12)); await page.waitForTimeout(1200)
for (const i of [0, 4, 8]) {
  await page.evaluate((i) => window.__town3dPeepFront(i, 4.2, 0.9), i)
  await page.waitForTimeout(800)
  await page.screenshot({ path: `scripts/_shots/peepf_${tag}_${i}.png` })
  console.log('peepf', tag, i)
}
await browser.close()
