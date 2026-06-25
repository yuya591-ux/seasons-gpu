import { chromium } from 'playwright'
const PORT = process.env.PORT || 4802
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 900, height: 460 }, deviceScaleFactor: 1.4 })
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2600)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(600)
await page.evaluate(() => window.__town3dCruise(false)); await page.waitForTimeout(200)
// 江戸の天守から少し離れた町・田畑の開けた所に降りる
const spots=[[675,-20,0.5],[610,-70,2.0],[640,10,3.1]]
for (let i=0;i<spots.length;i++){ const [x,z,yaw]=spots[i]; const gy=await page.evaluate(([x,z])=>window.__town3dGroundAt(x,z),[x,z])
  await page.evaluate(([x,gy,z,yaw])=>window.__town3dFlyPose(x,gy+5,z+8,yaw,-0.12),[x,gy,z,yaw]); await page.waitForTimeout(1100)
  await page.evaluate(()=>window.__town3dLand && window.__town3dLand(true)); await page.waitForTimeout(1500)
  await page.evaluate((yaw)=>window.__town3dFaceWalk && window.__town3dFaceWalk(yaw), yaw); await page.waitForTimeout(900)
  await page.screenshot({ path: `scripts/_shots/edowalk_${i}.png` }); console.log(i,'gy',gy.toFixed(1))
  await page.evaluate(()=>window.__town3dFly && window.__town3dFly(true)); await page.waitForTimeout(500)
}
await browser.close()
