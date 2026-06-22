// 夕焼け情景の検証: 街の夕景＋高空の茜の雲海
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 2 })
const errs = []
p.on('pageerror', (e) => errs.push(String(e)))
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(() => {})
await p.waitForTimeout(700)
await p.evaluate(() => window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(2600)
console.log('PAL:', JSON.stringify(await p.evaluate(() => window.__town3dPalProbe())))
await p.screenshot({ path: 'scripts/_shots/sunset-0-window.png' })
await p.evaluate(() => window.__town3dFly(true)); await p.waitForTimeout(700)
await p.evaluate(() => window.__town3dCruise(false))
// 街の夕景を上空から一望
await p.evaluate(() => window.__town3dFlyPose(0, 46, -10, 0, -0.28)); await p.waitForTimeout(1000)
await p.screenshot({ path: 'scripts/_shots/sunset-1-town.png' })
// 雲海に出て茜の海原
await p.evaluate(() => window.__town3dFlyPose(0, 126, -40, 0.1, -0.26)); await p.waitForTimeout(1200)
await p.screenshot({ path: 'scripts/_shots/sunset-2-sea.png' })
// 群島＋茜の雲
await p.evaluate(() => window.__town3dFlyPose(-60, 118, -372, 0, -0.08)); await p.waitForTimeout(1200)
await p.screenshot({ path: 'scripts/_shots/sunset-3-island.png' })
console.log(errs.length ? 'ERR ' + errs.slice(0, 4).join(' | ') : 'no errors')
await b.close()
