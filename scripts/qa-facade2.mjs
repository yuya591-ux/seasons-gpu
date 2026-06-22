import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 2 })
const errs = []
p.on('pageerror', (e) => errs.push(String(e)))
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(() => {})
await p.waitForTimeout(800)
await p.evaluate(() => window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(2600)
await p.evaluate(() => window.__town3dFly(true)); await p.waitForTimeout(600)
await p.evaluate(() => window.__town3dCruise(false))
// 住宅密集地に着地してカメラを8方位に回し、玄関のある正面を探す
for (const [sx,sz] of [[28,-58],[-30,-48]]) {
  await p.evaluate(() => window.__town3dFly(true)); await p.waitForTimeout(150)
  await p.evaluate(([x,z]) => window.__town3dFlyPose(x, 24, z, 0.2, -0.1), [sx,sz]); await p.waitForTimeout(500)
  await p.evaluate(() => window.__town3dLand(true)); await p.waitForTimeout(1600)
  for (let i = 0; i < 4; i++) {
    await p.evaluate(() => { for (let k=0;k<4;k++) window.__town3dLook(0.4, 0) }) // ~90°ずつ回す(0.4*2.6*4≈4.16rad... 約一回りを4枚)
    await p.waitForTimeout(400)
    await p.screenshot({ path: `scripts/_shots/facade-${sx}_${sz}-${i}.png` })
  }
}
console.log(errs.length ? 'ERR ' + errs.slice(0, 4).join(' | ') : 'no errors')
await b.close()
