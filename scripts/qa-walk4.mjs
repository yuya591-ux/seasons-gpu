// 長め歩行で距離がスケールするか（=fps制約の証明）＋角を曲がるナビ＋画
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 1.6 })
const errs = []
p.on('pageerror', (e) => errs.push(String(e)))
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(() => {})
await p.waitForTimeout(800)
await p.evaluate(() => window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(2600)
const dbg = () => p.evaluate(() => window.__town3dDbg())
await p.evaluate(() => window.__town3dFly(true)); await p.waitForTimeout(600)
await p.evaluate(() => window.__town3dCruise(false))
await p.evaluate(() => window.__town3dFlyPose(-40, 24, -58, 0.2, -0.1)); await p.waitForTimeout(600)
await p.evaluate(() => window.__town3dLand(true)); await p.waitForTimeout(1700)
const d0 = await dbg(); console.log('着地:', `(${d0.x},${d0.z})`, 'yaw', d0.yaw)
await p.screenshot({ path: 'scripts/_shots/walk-a.png' })
// 開けた向き(openYaw)へ前進。3s毎に距離を刻む＝距離が伸び続ければ詰まりでなくfps制約
await p.evaluate(() => window.__town3dMove(0, 1))
let log = []
for (let i = 0; i < 4; i++) { await p.waitForTimeout(3000); const d = await dbg(); log.push(Math.hypot(d.x-d0.x, d.z-d0.z).toFixed(1)) }
await p.evaluate(() => window.__town3dMove(0, 0)); await p.waitForTimeout(200)
const dN = await dbg()
console.log('前進3/6/9/12s 累積距離:', log.join(' → '), 'u  到達', `(${dN.x},${dN.z})`)
await p.screenshot({ path: 'scripts/_shots/walk-b.png' })
// 角を曲がる: 右へ倒して(1,0)向き直り、進む
await p.evaluate(() => window.__town3dMove(1, 0.3)); await p.waitForTimeout(3500)
await p.evaluate(() => window.__town3dMove(0, 0)); await p.waitForTimeout(200)
const dC = await dbg()
console.log('右へ曲がって進む 到達:', `(${dC.x},${dC.z})`, 'yaw', dC.yaw)
await p.screenshot({ path: 'scripts/_shots/walk-c.png' })
console.log(errs.length ? 'ERR ' + errs.slice(0, 4).join(' | ') : 'no errors')
await b.close()
