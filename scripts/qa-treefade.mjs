import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 2 })
const errs = []
p.on('pageerror', (e) => errs.push(String(e)))
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(() => {})
await p.waitForTimeout(800)
await p.evaluate(() => window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(2600)
await p.evaluate(() => window.__town3dFly(true)); await p.waitForTimeout(600)
await p.evaluate(() => window.__town3dCruise(false))
// 木が近い住宅地に着地→前進して木に寄る
await p.evaluate(() => window.__town3dFlyPose(-40, 24, -58, 0.2, -0.1)); await p.waitForTimeout(500)
await p.evaluate(() => window.__town3dLand(true)); await p.waitForTimeout(1600)
await p.screenshot({ path: 'scripts/_shots/treefade-0.png' }) // 着地直後
// 数方位に回しながら前進して木へ寄る
for (let i=0;i<4;i++){
  await p.evaluate(() => window.__town3dMove(0,1)); await p.waitForTimeout(2200); await p.evaluate(() => window.__town3dMove(0,0))
  await p.evaluate(() => { for(let k=0;k<3;k++) window.__town3dLook(0.4,0) }); await p.waitForTimeout(400)
  await p.screenshot({ path: `scripts/_shots/treefade-${i+1}.png` })
}
console.log(errs.length ? 'ERR ' + errs.slice(0, 4).join(' | ') : 'no errors')
await b.close()
