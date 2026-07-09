import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 2 })
const errs = []
p.on('pageerror', (e) => errs.push(String(e)))
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(() => {})
await p.waitForTimeout(800)
await p.evaluate(() => window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(2600)
console.log('objs(不変のはず):', (await p.evaluate(()=>window.__town3dStats())).objs)
await p.evaluate(() => window.__town3dFly(true)); await p.waitForTimeout(600)
await p.evaluate(() => window.__town3dCruise(false))
await p.evaluate(() => window.__town3dFlyPose(0, 50, -20, 0.2, 0.15)); await p.waitForTimeout(1200)
await p.screenshot({ path: 'scripts/_shots/lowpoly-clouds.png' })
console.log(errs.length ? 'ERR '+errs.slice(0,3).join(' | ') : 'no errors')
await b.close()
