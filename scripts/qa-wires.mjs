// 路地裏の電線網の検証: 住宅街の上を低空で飛び、交差する電線を捉える
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
// 住宅街(東西の電線が交差するあたり)の上を低空で水平に眺める
await p.evaluate(() => window.__town3dFlyPose(-80, 22, -10, 0.9, -0.06)); await p.waitForTimeout(1200)
await p.screenshot({ path: 'scripts/_shots/wires-1.png' })
// 別の交差点（南北×東西）を見下ろし気味に
await p.evaluate(() => window.__town3dFlyPose(-40, 30, -50, 1.6, -0.28)); await p.waitForTimeout(1000)
await p.screenshot({ path: 'scripts/_shots/wires-2.png' })
// 夜の電線（夕景シーンは夕方なので夜シーンでも一枚）
await p.evaluate(() => window.__applyScene('kitaterao-window-3d-night')); await p.waitForTimeout(2400)
await p.evaluate(() => window.__town3dFlyPose(-80, 24, -10, 0.9, -0.08)); await p.waitForTimeout(1000)
await p.screenshot({ path: 'scripts/_shots/wires-night.png' })
console.log(errs.length ? 'ERR ' + errs.slice(0, 4).join(' | ') : 'no errors')
await b.close()
