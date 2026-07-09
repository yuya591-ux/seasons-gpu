import { chromium } from 'playwright'
const PORT = process.env.PORT || 4876
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 720, height: 720 }, deviceScaleFactor: 2 })
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2600)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(700)
await page.evaluate(() => window.__town3dCruise(false)); await page.waitForTimeout(300)
// 開けた所へ（地面が見える低空・少し見下ろし）。その視線上に住人を立たせて接写。
await page.evaluate(() => window.__town3dFlyPose(0, 2.0, 8, 0, -0.12))
await page.waitForTimeout(1500)
for (const i of [0, 6, 12, 20, 30, 40]) {
  await page.evaluate((i) => { window.__town3dResFace && window.__town3dResFace(i, 0); window.__town3dResFront && window.__town3dResFront(i, 4.5, 0.6) }, i)
  await page.waitForTimeout(900)
  await page.screenshot({ path: `scripts/_shots/face_${i}.png` })
  console.log('face', i)
}
await browser.close()
