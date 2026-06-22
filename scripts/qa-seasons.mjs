import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 760, height: 460 }, deviceScaleFactor: 2 })
const errs = []
p.on('pageerror', (e) => errs.push(String(e)))
p.on('console', (m) => { if (m.type()==='error') errs.push(m.text()) })
await p.goto('http://localhost:4801/seasons/?dev=1', { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(700)
for (const s of ['kitaterao-window-3d-spring','kitaterao-window-3d-autumn','kitaterao-window-3d-snow']) {
  await p.evaluate((sc)=>window.__applyScene(sc), s); await p.waitForTimeout(2500)
  const pal = await p.evaluate(()=>window.__town3dPalProbe())
  await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(700)
  await p.evaluate(()=>window.__town3dCruise(false))
  // 街の一望
  await p.evaluate(()=>window.__town3dFlyPose(0,46,-10,0,-0.28)); await p.waitForTimeout(900)
  await p.screenshot({ path: `scripts/_shots/season-${s.split('-').pop()}-town.png` })
  // 雲海
  await p.evaluate(()=>window.__town3dFlyPose(-60,118,-372,0,-0.08)); await p.waitForTimeout(1000)
  await p.screenshot({ path: `scripts/_shots/season-${s.split('-').pop()}-sea.png` })
  console.log(s, JSON.stringify(pal))
}
console.log(errs.length ? 'ERR '+errs.slice(0,4).join(' | ') : 'no errors')
await b.close()
