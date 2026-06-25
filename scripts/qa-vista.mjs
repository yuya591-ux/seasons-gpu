import { chromium } from 'playwright'
const PORT = process.env.PORT || 4885
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 900, height: 440 }, deviceScaleFactor: 1.5 })
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2600)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(600)
await page.evaluate(() => window.__town3dCruise(false)); await page.waitForTimeout(200)
// 通りの中央に降りて、通りの軸に沿って見通す（クリーンな歩行目線）
const spots = [
  ['arcade_down', 0, -8, Math.PI],    // 商店街を南へ見通す
  ['arcade_up', 0, -40, 0.0],         // 商店街を北へ
  ['resi_st', 24, -45, Math.PI],      // 住宅街の通り
  ['apt', -20, -50, 0.6],             // 集合住宅
]
for (const [n, x, z, yaw] of spots) {
  const gy = await page.evaluate(([x,z])=>window.__town3dGroundAt(x,z), [x,z])
  await page.evaluate(([x,gy,z,yaw]) => { window.__town3dFlyPose(x, gy+4, z, yaw, -0.1) }, [x,gy,z,yaw])
  await page.waitForTimeout(1000)
  await page.evaluate(() => window.__town3dLand && window.__town3dLand(true)); await page.waitForTimeout(1500)
  await page.evaluate((y) => window.__town3dFaceWalk && window.__town3dFaceWalk(y), yaw)
  await page.waitForTimeout(1000)
  await page.screenshot({ path: `scripts/_shots/vista_${n}.png` })
  console.log('shot', n)
  await page.evaluate(() => window.__town3dFly && window.__town3dFly(true)); await page.waitForTimeout(500)
}
await browser.close()
