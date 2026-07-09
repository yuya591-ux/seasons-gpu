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
await p.evaluate(() => window.__applyScene('kitaterao-window-3d-rain-night'))
await p.waitForTimeout(2800)
await p.evaluate(() => window.__town3dFly(true)); await p.waitForTimeout(600)
await p.evaluate(() => window.__town3dCruise(false))
await p.evaluate(() => window.__town3dFlyPose(2, 20, -30, 0.2, -0.04)); await p.waitForTimeout(1000)
// 連続発火しながら最初の数フレームを撮る（減衰前のピークを捉える）
await p.evaluate(() => window.__town3dFlash(1))
await p.screenshot({ path: 'scripts/_shots/flash2-a.png' })
await p.waitForTimeout(120); await p.evaluate(() => window.__town3dFlash(1)); await p.screenshot({ path: 'scripts/_shots/flash2-b.png' })
console.log(errs.length ? 'ERR ' + errs.slice(0, 4).join(' | ') : 'no errors')
await b.close()
