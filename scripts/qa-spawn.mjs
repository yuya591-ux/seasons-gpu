import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 800, height: 500 } })
p.on('console', (m) => { if (m.type() === 'error') console.log('ERR', m.text()) })
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(() => {})
await p.waitForTimeout(800)
await p.evaluate(() => window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(2600)
const dbg = () => p.evaluate(() => window.__town3dDbg())
await p.evaluate(() => window.__town3dFly(true)); await p.waitForTimeout(600)
await p.evaluate(() => window.__town3dCruise(false))
// 密集地(商店街/downtown 0,-36 付近)上空から着地→開放度
for (const [x,z] of [[0,-36],[-20,-20],[28,-58],[14,-40],[40,-90]]) {
  await p.evaluate(() => window.__town3dFly(true)); await p.waitForTimeout(150)
  await p.evaluate(([x,z]) => window.__town3dFlyPose(x, 24, z, 0.2, -0.1), [x,z]); await p.waitForTimeout(500)
  await p.evaluate(() => window.__town3dLand(true)); await p.waitForTimeout(1500)
  const d = await dbg()
  const cl = await p.evaluate(([x,z]) => window.__town3dClear(x,z), [d.x, d.z])
  const mx = Math.max(...cl)
  console.log(`上空(${x},${z})→着地(${d.x},${d.z}) 最大通行距離=${mx}u  (16方位 ${cl.join(' ')})`)
}
await b.close()
