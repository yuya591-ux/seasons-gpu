// 中央通り(衝突なし回廊)で長距離歩けるか＝回廊の機能切り分け
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
// 中央通り(x=0)上空へ→着地
await p.evaluate(() => window.__town3dFlyPose(0, 24, -36, 0.0, -0.1)); await p.waitForTimeout(600)
await p.evaluate(() => window.__town3dLand(true)); await p.waitForTimeout(1700)
const d0 = await dbg(); console.log('中央通り着地:', JSON.stringify(d0))
// 進路を -z(奥) に固定して前進（中央通りに沿う）。__town3dFaceWalkで向きを直接指定
for (const yaw of [0, Math.PI]) {
  await p.evaluate(([x,z]) => window.__town3dFlyPose(0, 24, -36, 0.0, -0.1), []); // reset above? no, already walking
}
// まず奥(-z, yaw=0)へ
await p.evaluate(() => { window.__town3dFaceWalk(0) })
await p.evaluate(() => window.__town3dMove(0, 1)); 
let prev = await dbg(); let log=[]
for (let i=0;i<5;i++){ await p.waitForTimeout(800); const dd=await dbg(); log.push(`(${dd.x},${dd.z})`); }
await p.evaluate(() => window.__town3dMove(0, 0)); await p.waitForTimeout(200)
const dN = await dbg()
console.log('中央通りを奥へ4s 軌跡:', log.join(' → '))
console.log('総移動:', Math.hypot(dN.x-d0.x, dN.z-d0.z).toFixed(1), 'u  到達', `(${dN.x},${dN.z})`)
console.log(errs.length ? 'ERR ' + errs.slice(0, 4).join(' | ') : 'no errors')
await b.close()
