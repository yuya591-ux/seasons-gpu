import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1.5 })
const errs=[]; p.on('pageerror',e=>errs.push(String(e)))
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(700)
for (const [scene,tag] of [['kitaterao-window-3d-spring','spring'],['kitaterao-window-3d-autumn','autumn']]) {
  await p.evaluate(s=>window.__applyScene(s), scene); await p.waitForTimeout(2400)
  await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(600)
  await p.evaluate(()=>window.__town3dFlyPose(16,9,-22,0,-0.05)); await p.waitForTimeout(500)
  await p.evaluate(()=>window.__town3dLand(true)); await p.waitForTimeout(4500)
  await p.screenshot({ path:`scripts/_shots/nearfall-${tag}.png` })
  console.log(tag, JSON.stringify(await p.evaluate(()=>window.__town3dJumpState())))
}
console.log(errs.length?'ERR '+errs.slice(0,2):'no errors')
await b.close()
