import { chromium } from 'playwright'
const PORT = process.env.PORT || 4877
const tag = process.argv[2] || 'before'
const browser = await chromium.launch()
// 横画面（実機のlandscape）でベースライン
const page = await browser.newPage({ viewport: { width: 880, height: 420 }, deviceScaleFactor: 1.5 })
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2600)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(600)
await page.evaluate(() => window.__town3dCruise(false)); await page.waitForTimeout(300)
// 低空・水平に近い見下ろし＝歩行目線で地面の広がりを見る
const shots = [
  ['open_s', 0, 2.6, -40, 0, -0.06],     // 南の開け
  ['open_e', 30, 2.6, -10, 1.4, -0.05],  // 東側の開け
  ['slope', -20, 3.0, -30, 0.5, -0.08],  // 斜面
  ['park', 16, 2.8, -18, 0.2, -0.05],    // 公園周り
]
for (const [n, x, y, z, yw, pt] of shots) {
  await page.evaluate(([x,y,z,yw,pt]) => window.__town3dFlyPose(x,y,z,yw,pt), [x,y,z,yw,pt])
  await page.waitForTimeout(2000)
  await page.screenshot({ path: `scripts/_shots/grd_${tag}_${n}.png` })
  console.log('shot', n)
}
await browser.close()
