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
await p.evaluate(() => window.__applyScene('kitaterao-window-3d-rain'))
await p.waitForTimeout(3000)
await p.screenshot({ path: 'scripts/_shots/rain3d-window.png' }) // 窓辺の雨
const pal = await p.evaluate(() => window.__town3dPalProbe())
console.log('palette:', JSON.stringify(pal))
// 飛んで街を低空で（雨筋＋濡れた路面）
await p.evaluate(() => window.__town3dFly(true)); await p.waitForTimeout(700)
await p.evaluate(() => window.__town3dCruise(false))
await p.evaluate(() => window.__town3dFlyPose(2, 18, -30, 0.2, -0.05)); await p.waitForTimeout(1200)
await p.screenshot({ path: 'scripts/_shots/rain3d-air.png' })
// 着地して雨の路地を歩く
await p.evaluate(() => window.__town3dLand(true)); await p.waitForTimeout(1600)
await p.evaluate(() => { for(let k=0;k<2;k++) window.__town3dLook(0.4,0) }); await p.waitForTimeout(500)
await p.screenshot({ path: 'scripts/_shots/rain3d-walk.png' })
console.log(errs.length ? 'ERR ' + errs.slice(0, 4).join(' | ') : 'no errors')
await b.close()
