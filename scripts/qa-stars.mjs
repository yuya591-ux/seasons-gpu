// 夜の満天の星＋天の川の検証（雲の上で空を見上げる）
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
await p.evaluate(() => window.__applyScene('kitaterao-window-3d-night'))
await p.waitForTimeout(2600)
await p.evaluate(() => window.__town3dFly(true)); await p.waitForTimeout(700)
await p.evaluate(() => window.__town3dCruise(false))
// 雲の上で空を見上げる（星空＋天の川＋月）
await p.evaluate(() => window.__town3dFlyPose(0, 122, -50, -0.4, 0.62)); await p.waitForTimeout(1200)
await p.screenshot({ path: 'scripts/_shots/stars-1.png' })
// 別角度（天の川の帯）
await p.evaluate(() => window.__town3dFlyPose(20, 124, -30, 0.6, 0.66)); await p.waitForTimeout(1000)
await p.screenshot({ path: 'scripts/_shots/stars-2.png' })
console.log(errs.length ? 'ERR ' + errs.slice(0, 4).join(' | ') : 'no errors')
await b.close()
