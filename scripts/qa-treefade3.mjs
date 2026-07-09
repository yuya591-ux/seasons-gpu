import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 2 })
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(() => {})
await p.waitForTimeout(800)
await p.evaluate(() => window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(2600)
await p.evaluate(() => window.__town3dFly(true)); await p.waitForTimeout(600)
await p.evaluate(() => window.__town3dCruise(false))
await p.evaluate(() => window.__town3dFlyPose(-40, 24, -58, 0.2, -0.1)); await p.waitForTimeout(500)
await p.evaluate(() => window.__town3dLand(true)); await p.waitForTimeout(1600)
// 最寄りの木へ寄り、近づいたところで撮る
for (let i=0;i<10;i++){
  const np = await p.evaluate(() => window.__town3dTreeProbe())
  if (np.opacity < 0.6) { await p.screenshot({ path: 'scripts/_shots/treefade-close.png' }); console.log('captured at dist',np.dist,'op',np.opacity); break }
  await p.evaluate(() => window.__town3dMove(0,1)); await p.waitForTimeout(800); await p.evaluate(() => window.__town3dMove(0,0))
}
await b.close()
