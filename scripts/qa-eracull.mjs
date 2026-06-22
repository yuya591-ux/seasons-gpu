import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 900, height: 560 }, deviceScaleFactor: 2 })
const errs = []
p.on('pageerror', (e) => errs.push(String(e)))
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(() => {})
await p.waitForTimeout(800)
await p.evaluate(() => window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(2600)
await p.evaluate(() => window.__town3dFly(true)); await p.waitForTimeout(600)
await p.evaluate(() => window.__town3dCruise(false))
// 各時代の中心近くへ行って表示を確認
for (const [name,x,z] of [['本町',0,-40],['江戸',640,-46],['大正',-640,-30],['戦国',140,-640]]) {
  await p.evaluate(([x,z]) => window.__town3dFlyPose(x, 70, z+120, 0.0, -0.35), [x,z]); await p.waitForTimeout(1200)
  await p.screenshot({ path: `scripts/_shots/eracull-${name}.png` })
}
console.log(errs.length ? 'ERR ' + errs.slice(0,3).join(' | ') : 'no errors')
await b.close()
