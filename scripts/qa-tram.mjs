import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 960, height: 560 }, deviceScaleFactor: 2 })
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
// 大正(tx=-640,tz=-30)の電車通り(z=-30)を低空で見通す。tram は時々通る
await p.evaluate(() => window.__town3dFlyPose(-700, 16, -30, Math.PI/2, 0.02)); await p.waitForTimeout(1500)
await p.screenshot({ path: 'scripts/_shots/tram-corridor.png' })
await p.evaluate(() => window.__town3dFlyPose(-640, 40, -8, 0.0, -0.25)); await p.waitForTimeout(1200)
await p.screenshot({ path: 'scripts/_shots/tram-top.png' })
console.log(errs.length ? 'ERR ' + errs.slice(0,3).join(' | ') : 'no errors')
await b.close()
