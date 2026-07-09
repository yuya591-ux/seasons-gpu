import { chromium } from 'playwright'
const PORT = process.env.PORT || 4876
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 760, height: 720 }, deviceScaleFactor: 2 })
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1&fest=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2600)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(600)
await page.evaluate(() => window.__town3dCruise(false)); await page.waitForTimeout(300)
const shots = [
  ['arcade_low', 0, 1.7, -8, 0.0, -0.04],   // 商店街の通り（買い物客=loiter peep）
  ['gate_low',   0, 1.7, -10, 0.0, 0.0],
  ['station_low',34, 1.7, -36, 0.0, 0.02],   // 駅前の人だまり
  ['plaza_fes',  0, 2.2, 12, 0.0, -0.1],     // 目の前の広場の盆踊り（踊り手＋見物）
]
for (const [name, x, y, z, yaw, pitch] of shots) {
  await page.evaluate(([x, y, z, yaw, pitch]) => window.__town3dFlyPose(x, y, z, yaw, pitch), [x, y, z, yaw, pitch])
  await page.waitForTimeout(2200)
  await page.screenshot({ path: `scripts/_shots/peep_${name}.png` })
  console.log('shot', name)
}
await browser.close()
