import { chromium } from 'playwright'
const PORT = process.env.PORT || 4881
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 900, height: 430 }, deviceScaleFactor: 1.5 })
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2600)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(700)
// 開けた所へ移動してから着地
await page.evaluate(() => window.__town3dFlyPose(18, 6, -52, 0, -0.1)); await page.waitForTimeout(1500)
await page.evaluate(() => window.__town3dLand && window.__town3dLand(true)); await page.waitForTimeout(1800)
const dbg = await page.evaluate(()=>window.__town3dDbg && window.__town3dDbg())
console.log('walk dbg', JSON.stringify(dbg))
for (let k=0;k<4;k++){
  await page.evaluate((y)=>window.__town3dFaceWalk && window.__town3dFaceWalk(y), k*1.57)
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `scripts/_shots/walk_${k}.png` })
}
await browser.close()
