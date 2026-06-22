import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 960, height: 560 }, deviceScaleFactor: 2 })
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
// 江戸(640,-46)に着地して散歩目線
await p.evaluate(() => window.__town3dFlyPose(640, 30, -10, 0.0, -0.1)); await p.waitForTimeout(800)
await p.evaluate(() => window.__town3dLand(true)); await p.waitForTimeout(1700)
await p.screenshot({ path: 'scripts/_shots/eraeye-edo.png' })
// 戦国(140,-640)に着地
await p.evaluate(() => window.__town3dFly(true)); await p.waitForTimeout(300)
await p.evaluate(() => window.__town3dFlyPose(140, 30, -620, 0.0, -0.1)); await p.waitForTimeout(800)
await p.evaluate(() => window.__town3dLand(true)); await p.waitForTimeout(1700)
await p.screenshot({ path: 'scripts/_shots/eraeye-sengoku.png' })
console.log(errs.length ? 'ERR ' + errs.slice(0,3).join(' | ') : 'no errors')
await b.close()
