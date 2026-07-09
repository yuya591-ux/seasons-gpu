// 全3D街シーンの健全性スモーク: mount→飛行→着地→歩行でコンソールエラー0か
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 800, height: 500 }, deviceScaleFactor: 1.5 })
const scenes = ['kitaterao-window-3d','kitaterao-window-3d-sunset','kitaterao-window-3d-rain','kitaterao-window-3d-rain-night','kitaterao-window-3d-night','kitaterao-window-3d-snow','kitaterao-window-3d-snow-night','kitaterao-window-3d-spring','kitaterao-window-3d-autumn','shishigaya-window-3d']
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(() => {})
await p.waitForTimeout(700)
for (const s of scenes) {
  const errs = []
  const onerr = (e) => errs.push(String(e).slice(0,90))
  const oncon = (m) => { if (m.type() === 'error') errs.push(m.text().slice(0,90)) }
  p.on('pageerror', onerr); p.on('console', oncon)
  await p.evaluate((sid) => window.__applyScene(sid), s); await p.waitForTimeout(2600)
  const fly = await p.evaluate(() => typeof window.__town3dFly)
  await p.evaluate(() => window.__town3dFly && window.__town3dFly(true)); await p.waitForTimeout(500)
  await p.evaluate(() => window.__town3dCruise && window.__town3dCruise(true)); await p.waitForTimeout(900)
  await p.evaluate(() => window.__town3dLand && window.__town3dLand(true)); await p.waitForTimeout(1200)
  await p.evaluate(() => window.__town3dMove && window.__town3dMove(0,1)); await p.waitForTimeout(900); await p.evaluate(() => window.__town3dMove && window.__town3dMove(0,0))
  p.off('pageerror', onerr); p.off('console', oncon)
  console.log(`${fly==='function'?'OK ':'FLY?'} ${s}  ${errs.length? 'ERR: '+errs.slice(0,2).join(' | ') : 'clean'}`)
}
await b.close()
