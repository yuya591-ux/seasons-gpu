import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 2 })
const errs = []
p.on('pageerror', (e) => errs.push(String(e)))
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(() => {})
await p.waitForTimeout(800)
await p.evaluate(() => window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(2600)
await p.evaluate(() => window.__town3dFly(true)); await p.waitForTimeout(600)
await p.evaluate(() => window.__town3dCruise(false))
await p.evaluate(() => window.__town3dFlyPose(-40, 24, -58, 0.2, -0.1)); await p.waitForTimeout(500)
await p.evaluate(() => window.__town3dLand(true)); await p.waitForTimeout(1600)
// 最寄りの木へ向かって歩き、距離と樹冠透明度を刻む
for (let i=0;i<10;i++){
  const np = await p.evaluate(() => window.__town3dTreeProbe())
  console.log(`step${i}: dist=${np.dist} faded=${np.faded} opacity=${np.opacity}`)
  if (np.dist < 2.2) { await p.screenshot({ path: 'scripts/_shots/treefade-close.png' }); break }
  // 最寄りの木の方向へ向き直って前進（向きはopenYawのまま前進＝適当に進み、見回しで木を探す）
  await p.evaluate(() => window.__town3dMove(0,1)); await p.waitForTimeout(900); await p.evaluate(() => window.__town3dMove(0,0))
}
console.log(errs.length ? 'ERR ' + errs.slice(0, 4).join(' | ') : 'no errors')
await b.close()
