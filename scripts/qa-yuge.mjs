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
await p.waitForTimeout(3500) // 窓辺（夕餉の煙が窓の外に見えるか）
await p.screenshot({ path: 'scripts/_shots/yuge-window.png' })
// 飛んで街を横から（家々の細い煙のたなびきを確認）
await p.evaluate(() => window.__town3dFly(true)); await p.waitForTimeout(700)
await p.evaluate(() => window.__town3dCruise(false))
await p.evaluate(() => window.__town3dFlyPose(-40, 18, -30, Math.PI/2, 0.06)); await p.waitForTimeout(3500)
await p.screenshot({ path: 'scripts/_shots/yuge-air.png' })
console.log(errs.length ? 'ERR ' + errs.slice(0, 4).join(' | ') : 'no errors')
await b.close()
