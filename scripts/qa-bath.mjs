import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 920, height: 600 }, deviceScaleFactor: 2 })
const errs = []
p.on('pageerror', (e) => errs.push(String(e)))
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(() => {})
await p.waitForTimeout(700)
await p.evaluate(() => window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(2400)
await p.evaluate(() => window.__town3dFly(true)); await p.waitForTimeout(700)
await p.evaluate(() => window.__town3dCruise(false))
// 西から(yaw=+x) 銭湯(-24,-34)を見る
await p.evaluate(() => window.__town3dFlyPose(-46, 17, -34, Math.PI/2, 0.12)); await p.waitForTimeout(1500)
await p.screenshot({ path: 'scripts/_shots/bath-1.png' })
await p.waitForTimeout(4500)
await p.screenshot({ path: 'scripts/_shots/bath-2.png' })
// 東から(yaw=-x)
await p.evaluate(() => window.__town3dFlyPose(-2, 17, -34, -Math.PI/2, 0.12)); await p.waitForTimeout(1500)
await p.screenshot({ path: 'scripts/_shots/bath-3.png' })
console.log(errs.length ? 'ERR ' + errs.slice(0, 4).join(' | ') : 'no errors')
await b.close()
