import { chromium } from 'playwright'
const PORT = process.env.PORT || 4885
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 900, height: 440 }, deviceScaleFactor: 1.5 })
const errs=[]; page.on('pageerror',e=>errs.push('PE:'+e.message))
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2600)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(600)
await page.evaluate(() => window.__town3dCruise(false)); await page.waitForTimeout(200)
// 各スポットへ低空で行き着地→歩行目線で見回し撮影
const spots = [
  ['arcade', 0, -18, 0.0],   // 商店街
  ['station', 33, -38, 0.2], // 駅前
  ['park', 15, -24, 0.5],    // 公園
  ['canal', -44, -20, 1.4],  // 川辺
  ['resi', 24, -60, 0.3],    // 住宅街
  ['plaza', 0, 2, 3.1],      // 目の前の広場
]
for (const [n, x, z, yaw] of spots) {
  const gy = await page.evaluate(([x,z])=>window.__town3dGroundAt(x,z), [x,z])
  await page.evaluate(([x,gy,z,yaw]) => { window.__town3dFlyPose(x, gy+5, z+6, yaw, -0.15) }, [x,gy,z,yaw])
  await page.waitForTimeout(1200)
  await page.evaluate(() => window.__town3dLand && window.__town3dLand(true)); await page.waitForTimeout(1400)
  await page.evaluate((y) => window.__town3dFaceWalk && window.__town3dFaceWalk(y), yaw)
  await page.waitForTimeout(1000)
  await page.screenshot({ path: `scripts/_shots/sv_${n}.png` })
  console.log('shot', n, 'gy', gy.toFixed(1))
  await page.evaluate(() => window.__town3dFly && window.__town3dFly(true)); await page.waitForTimeout(500)
}
console.log(errs.length?'ERR':'ok')
await browser.close()
