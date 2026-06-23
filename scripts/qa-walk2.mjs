// 複数地点に着地して前進距離を測る（透明の壁で即詰まりしないか＝路地の通行性）
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 1.6 })
const errs = []
p.on('pageerror', (e) => errs.push(String(e)))
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(() => {})
await p.waitForTimeout(800)
await p.evaluate(() => window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(2600)
const dbg = () => p.evaluate(() => window.__town3dDbg())
await p.evaluate(() => window.__town3dFly(true)); await p.waitForTimeout(600)
await p.evaluate(() => window.__town3dCruise(false))
const spots = [[-40,-58],[28,-58],[-55,-30],[40,-90],[-22,-78],[14,-40]]
for (const [sx,sz] of spots) {
  await p.evaluate(([x,z]) => window.__town3dFly(true), [sx,sz]); await p.waitForTimeout(150)
  await p.evaluate(([x,z]) => window.__town3dFlyPose(x, 24, z, 0.2, -0.1), [sx,sz]); await p.waitForTimeout(500)
  await p.evaluate(() => window.__town3dLand(true)); await p.waitForTimeout(1600)
  const d0 = await dbg()
  // openYaw方向へ前進3s
  await p.evaluate(() => window.__town3dMove(0, 1)); await p.waitForTimeout(3000)
  await p.evaluate(() => window.__town3dMove(0, 0)); await p.waitForTimeout(200)
  const d1 = await dbg()
  const dist = Math.hypot(d1.x - d0.x, d1.z - d0.z)
  console.log(`着地(${sx},${sz})→(${d0.x},${d0.z}) yaw${d0.yaw}  前進3s 距離=${dist.toFixed(1)}u  到達(${d1.x},${d1.z})`)
  // 次の地点へ飛び立ち
  await p.evaluate(() => window.__town3dFly(true)); await p.waitForTimeout(150)
}
console.log(errs.length ? 'ERR ' + errs.slice(0, 4).join(' | ') : 'no errors')
await b.close()
