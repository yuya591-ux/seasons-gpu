import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 1.6 })
const errs = []
p.on('pageerror', (e) => errs.push(String(e)))
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(() => {})
await p.waitForTimeout(800)
await p.evaluate(() => window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(2600)
const measFps = async (ms) => p.evaluate((ms) => new Promise((res) => {
  let n = 0; const t0 = performance.now()
  const tick = () => { n++; if (performance.now() - t0 < ms) requestAnimationFrame(tick); else res(Math.round(n / ((performance.now() - t0) / 1000))) }
  requestAnimationFrame(tick)
}), ms)
const statsWindow = await p.evaluate(() => window.__town3dStats())
const fpsIdle = await measFps(2500)
// 飛び立って巡航（能動飛行＝30fps目標）
await p.evaluate(() => window.__town3dFly(true)); await p.waitForTimeout(700)
await p.evaluate(() => window.__town3dCruise(true)); await p.waitForTimeout(700)
await p.evaluate(() => window.__town3dFlyPose(-30, 24, -20, 0.2, -0.05)); await p.waitForTimeout(400)
await p.evaluate(() => window.__town3dCruise(true))
const fpsFly = await measFps(2500)
const statsFly = await p.evaluate(() => window.__town3dStats())
console.log('window stats:', JSON.stringify(statsWindow))
console.log('fly    stats:', JSON.stringify(statsFly))
console.log('fps idle(窓辺):', fpsIdle, ' fps fly(巡航):', fpsFly)
console.log(errs.length ? 'ERR ' + errs.slice(0, 3).join(' | ') : 'no errors')
await b.close()
