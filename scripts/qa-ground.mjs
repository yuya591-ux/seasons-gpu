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
for (const [sx,sz,n] of [[28,-58,0],[-30,-48,1],[14,-40,2]]) {
  await p.evaluate(() => window.__town3dFly(true)); await p.waitForTimeout(150)
  await p.evaluate(([x,z]) => window.__town3dFlyPose(x, 24, z, 0.2, -0.1), [sx,sz]); await p.waitForTimeout(500)
  await p.evaluate(() => window.__town3dLand(true)); await p.waitForTimeout(1500)
  // 少し前進して路地の上へ、視線を足元へ下げる
  await p.evaluate(() => window.__town3dMove(0,1)); await p.waitForTimeout(1200); await p.evaluate(() => window.__town3dMove(0,0))
  await p.evaluate(() => { for(let k=0;k<5;k++) window.__town3dLook(0,-0.16) }) // 下を向く
  await p.waitForTimeout(500)
  await p.screenshot({ path: `scripts/_shots/ground-${n}.png` })
}
console.log(errs.length ? 'ERR ' + errs.slice(0, 4).join(' | ') : 'no errors')
await b.close()
