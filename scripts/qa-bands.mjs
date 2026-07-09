import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 2 })
const errs = []
p.on('pageerror', (e) => errs.push(String(e)))
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(() => {})
await p.waitForTimeout(800)
await p.evaluate(() => window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(2600)
await p.evaluate(() => window.__town3dFly(true)); await p.waitForTimeout(600)
await p.evaluate(() => window.__town3dCruise(false))
// 下町(DOWNTOWNは高い建物)あたりの中層ビルを近接で見る
await p.evaluate(() => window.__town3dFlyPose(-10, 14, 6, 0.0, 0.18)); await p.waitForTimeout(1200)
await p.screenshot({ path: 'scripts/_shots/bands-1.png' })
await p.evaluate(() => window.__town3dFlyPose(20, 12, -4, -0.6, 0.2)); await p.waitForTimeout(1000)
await p.screenshot({ path: 'scripts/_shots/bands-2.png' })
console.log(errs.length ? 'ERR '+errs.slice(0,3).join(' | ') : 'no errors')
await b.close()
