// 雲の温泉（露天＋湯けむり）の検証: 群島の全景と温泉のアップ
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 920, height: 560 }, deviceScaleFactor: 2 })
const errs = []
p.on('pageerror', (e) => errs.push(String(e)))
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(() => {})
await p.waitForTimeout(700)
await p.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await p.waitForTimeout(2400)
await p.evaluate(() => window.__town3dFly(true)); await p.waitForTimeout(700)
await p.evaluate(() => window.__town3dCruise(false))
// 群島の全景（5島＝中心の東屋・茶屋・見晴らし・祠・温泉）
await p.evaluate(() => window.__town3dFlyPose(-2, 132, -218, 0.1, -0.52)); await p.waitForTimeout(1200)
await p.screenshot({ path: 'scripts/_shots/onsen-air.png' })
// 温泉(30,-256)のアップ＝湯舟＋湯けむり
await p.evaluate(() => window.__town3dFlyPose(48, 118, -238, -0.7, -0.18)); await p.waitForTimeout(1400)
await p.screenshot({ path: 'scripts/_shots/onsen-close.png' })
console.log(errs.length ? 'ERR ' + errs.slice(0, 4).join(' | ') : 'no errors')
await b.close()
